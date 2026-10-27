// Static repository evidence only. Never connects to a warehouse or invokes an RPC.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const digest = text => createHash('sha256').update(text).digest('hex');
const review = 'https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6390540921';

/** Limited to checked-in CREATE FUNCTION dollar-quoted declarations, not a SQL parser. */
export function extractFunctions(sql) {
  const clean = sql.replace(/--[^\n]*/g, '');
  const pattern = /create\s+or\s+replace\s+function\s+public\.(bi_\w+_payload)\s*\(([\s\S]*?)\)\s*returns\s+jsonb\b([\s\S]*?)\bas\s+(\$\w*\$)([\s\S]*?)\4\s*;/gi;
  return [...clean.matchAll(pattern)].map(match => {
    const [,name,args,attributes,,body] = match;
    const parameters = args.split(',').map(arg => {
      const parts = arg.trim().match(/^(p_\w+)\s+(\w+)([\s\S]*)$/i);
      if (!parts) throw Error(`Unsupported parameter syntax: ${name}`);
      return {name: parts[1], type: parts[2].toLowerCase(), has_default: /\bdefault\b|=/i.test(parts[3])};
    });
    return {name, parameters, volatility: attributes.match(/\b(immutable|stable|volatile)\b/i)?.[1].toUpperCase() ?? 'VOLATILE',
      volatility_basis: /\b(immutable|stable|volatile)\b/i.test(attributes) ? 'EXPLICIT' : 'POSTGRESQL_DEFAULT',
      security_definer: /\bsecurity\s+definer\b/i.test(attributes),
      repository_definition_sha256: digest(match[0]),
      hash_scope: 'CREATE statement with line comments removed; NOT pg_get_functiondef and NOT a deployed hash', body};
  });
}

export function compareMetadata(repo, observed) {
  const mismatches = [];
  for (const key of ['volatility','security_definer']) {
    if (observed[key] != null && repo[key] !== observed[key]) mismatches.push(key);
  }
  if (observed.parameters != null && JSON.stringify(repo.parameters) !== JSON.stringify(observed.parameters)) mismatches.push('parameters');
  return {metadata_comparison: mismatches.length ? 'MISMATCH' : 'MATCH_ON_REPORTED_FIELDS_ONLY', mismatches,
    deployed_definition_parity: 'UNKNOWN'};
}

export function compareCaller(repo, suppliedNames) {
  return {unsupported: suppliedNames.filter(name => !repo.parameters.some(p => p.name === name)),
    missing_required: repo.parameters.filter(p => !p.has_default && !suppliedNames.includes(p.name)).map(p => p.name)};
}

/** Synthetic/local diagnostic: count grain collisions without emitting identities or summing money. */
export function grainDiagnostics(rows, keys) {
  const known = rows.filter(row => keys.every(key => row[key] != null && row[key] !== ''));
  return {rows: rows.length, unknown_key_rows: rows.length - known.length,
    duplicate_key_excess: known.length - new Set(known.map(row => JSON.stringify(keys.map(key => row[key])))).size};
}

const bindings = [
  {id:'sales', rpc:'bi_overview_payload', source:['fact_sales_daily.revenue'],
    json:'current.revenue', adapter:'web/lib/data/overview.ts', adapter_binding:'current.revenue → snapshot.kpis',
    ui:'web/app/page.tsx', ui_binding:'snapshot.kpis.map → KpiCard',
    grain:'date/location/brand/ownership/channel/order_type; joins and lifecycle must be reconciled',
    period:'p_focus_year/p_focus_month/p_period/p_comparison plus channel/order_type/location/brand/ownership/LFL',
    limitations:['SQL and adapter coalesce missing metrics; Sales null recovery and LFL D04/D07 OPEN','Fallback Google Sheets is a distinct path; no parity implied']},
  {id:'ga4', rpc:'bi_digital_payload', source:['staging_ga4_daily_windsor.sessions','digital_ga4_daily.sessions'],
    json:'current.sessions', adapter:'web/lib/data/digital-contract.ts', adapter_binding:'normalizeDigital → current.sessions',
    ui:'web/app/digital/page.tsx', ui_binding:'c.sessions', grain:'curated date_id; property/account identity not exposed',
    period:'p_from/p_to inclusive; previous window same day count immediately before from',
    limitations:['currentGa4Rows guards empty periods; partial nonnull SUM is not field completeness','Daily users are not period uniques; business timezone and revenue currency UNKNOWN']},
  {id:'gsc', rpc:'bi_digital_payload', source:['staging_searchconsole_daily_windsor.clicks','digital_search_daily.clicks/impressions'],
    json:'seo.clicks / seo.impressions', adapter:'web/lib/data/digital-contract.ts', adapter_binding:'seo → metricRatio(clicks,impressions)',
    ui:'web/app/digital/seo/page.tsx', ui_binding:'s.ctr', grain:'curated date_id; site/property identity not exposed',
    period:'p_from/p_to inclusive; snapshot query/page periods separate (40/30 row caps)',
    limitations:['CTR recomputed; zero denominator UNKNOWN','Stored daily coverage does not prove omitted-query or upstream completeness']},
  {id:'meta', rpc:'bi_digital_meta_ads_payload', source:['staging_meta_ads_windsor.spend','staging_meta_ads_daily.spend','meta_windsor_campaign_metrics.spend'],
    json:'summary.spend; meta.currency; campaigns[].account_id/campaign_id/account_currency',
    adapter:'web/lib/data/meta-social-contract.ts', adapter_binding:'normalizeMetaAds → summary.spend; meta.currency',
    ui:'web/app/digital/ads/page.tsx', ui_binding:'meta.summary.spend',
    grain:'date/account_id/campaign_id/account_currency; Windsor campaign-only rows; campaigns grouped by account/campaign/currency',
    period:'no caller period; latest curated date minus 29 through latest, campaign cap 50',
    limitations:['Attribution unverified suppresses ROAS; Meta USD cannot supply App currency','Bounded 138-group reviewer receipt is separate from rolling Gate D 145-row baseline']},
  {id:'google_ads_app', rpc:'bi_digital_app_payload', source:['staging_google_ads_windsor.cost/conversions/conversions_value'],
    json:'googleAdsApp[].spend/conversions/conversion_value/from_date/to_date',
    adapter:'web/lib/data/app-contract.ts', adapter_binding:'normalizeApp → currencyEvidence; costPerConversion = spend/conversions',
    ui:'web/app/digital/app/page.tsx', ui_binding:'money(row.spend,row); const money=sourceMoney',
    grain:'REPOSITORY MISMATCH: platform guessed from campaign_name + campaign_name; account_id/campaign_id/date/currency lost',
    period:"all history WHERE lower(campaign_name) LIKE 'app_%'; underscore is SQL wildcard; min/max dates only",
    limitations:['Reviewer reports deployed RPC references staging Google Ads and omits currency; exact definition/hash not supplied','No source currency column per earlier reviewer B02; money UNKNOWN, no FX or Meta currency inheritance','Proposed account/campaign/date/currency contract remains NOT APPLIED; no p_from/p_to arguments']},
  {id:'merchant', rpc:'bi_digital_merchant_payload', source:['staging_google_merchant_performance.impressions'],
    json:'performance.impressions; meta.performanceRows', adapter:'web/lib/data/merchant-contract.ts',
    adapter_binding:'normalizeMerchant → metricNumber; merchantPresence', ui:'web/app/digital/commerce/page.tsx',
    ui_binding:'performanceReady?n(p.impressions):"—"', grain:'date/product_id; account/country/context absent in performance key',
    period:'latest performance date minus 29 through latest; catalog stock all rows; health latest 20; products cap 50',
    limitations:['performanceRows is all-history presence, not field completeness','SQL COALESCE/SUM can erase nulls; adapter cannot restore them','Catalog currency does not prove performance or App currency']}
];

export function buildContracts() {
  const catalog = new Map();
  const files = ['supabase/schema.sql', ...fs.readdirSync(new URL('supabase/migrations/',root)).sort().map(n => `supabase/migrations/${n}`)];
  for (const path of files) for (const fn of extractFunctions(read(path))) catalog.set(fn.name, {...fn, path});
  return {schema_version:1, issue:43, existing_pr:44,
    verification:{code_docs:'STATIC_CONTRACTS; CHECK_RESULTS_IN_VERIFICATION_JSON', end_to_end_audit:'NOT_VERIFIED', live_rpc_invocations:0},
    reviewer_metadata:{review_url:review, evidence_class:'TRUSTED_TRIGGER_RELAY_NOT_INDEPENDENTLY_FETCHED',
      reported_volatility:'VOLATILE', reported_security_definer:true,
      exact_deployed_signatures:'NOT_SUPPLIED', exact_deployed_definitions:'NOT_SUPPLIED', exact_deployed_hashes:'NOT_SUPPLIED'},
    contracts:bindings.map(binding => {
      const fn = catalog.get(binding.rpc);
      if (!fn) throw Error(`Missing repository definition ${binding.rpc}`);
      const {body,...definition} = fn;
      const observed = {volatility:'VOLATILE',security_definer:true,parameters:null};
      return {...binding, repository:definition, reviewer_observation:observed,
        comparison:compareMetadata(fn,observed),
        static_evidence:[definition.path,binding.adapter,binding.ui].map(path => ({path, file_sha256:digest(read(path))})),
        freshness:'UNKNOWN; reviewer bounded date receipts in barbara-production-evidence.json are separate',
        upstream_completeness:'UNKNOWN', all_field_rpc_rendered_parity:'UNKNOWN', business_timezone:'UNKNOWN',
        production_rpc_execution:'PROHIBITED_IN_THIS_AUDIT', status:'PARTIAL'};
    })};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = new URL('docs/audit/2026-10-24/rpc-contract-lineage.json',root);
  const text = JSON.stringify(buildContracts(),null,2)+'\n';
  if (process.argv.includes('--check')) {
    if (read('docs/audit/2026-10-24/rpc-contract-lineage.json') !== text) throw Error('RPC lineage is stale');
  } else fs.writeFileSync(target,text);
  console.log('6 static KPI contracts; deployed definition parity UNKNOWN; RPC invocations 0');
}
