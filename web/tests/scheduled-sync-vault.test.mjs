import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const sqlPath = "docs/sql/issue-27-scheduled-sync-vault-NOT-APPLIED.sql";
const docPath = "docs/scheduled-sync-vault.md";
const read = (path) => readFileSync(new URL(path, root), "utf8");
const sql = read(sqlPath);
const code = sql.replace(/--[^\n]*/g, "");
const doc = read(docPath);
const includes = (text, fragment, message) => assert.ok(text.includes(fragment), message);

// Never pass file contents/captured candidates to assertions: a failure must not
// echo an accidentally introduced credential into CI or PR logs.
function hasCredentialLiteral(text) {
  return /["']x-bi-sync-key["']\s*[:,]\s*(?:[eE])?["'][^"'\r\n]+["']/i.test(text)
    || /["'][A-Za-z0-9_+\/=\-]{26}["']/.test(text);
}

test("issue 27 source rejects credential-shaped literals without echoing them", () => {
  const generated = "z".repeat(26);
  const header = "'x-bi-sync-key'";
  assert.ok(hasCredentialLiteral(`'${generated}'`), "scanner must detect a quoted candidate");
  assert.ok(hasCredentialLiteral([header, `'${"sample".repeat(3)}'`].join(", ")), "scanner must detect header literals of any length");
  for (const text of [sql, doc, read("web/tests/scheduled-sync-vault.test.mjs")]) {
    assert.ok(!hasCredentialLiteral(text), "issue 27 artifact contains a forbidden credential-shaped literal");
  }
});

test("issue 27 is a rollback-only artifact outside automatic migrations", () => {
  assert.ok(sqlPath.startsWith("docs/sql/"));
  includes(sql, "NOT APPLIED", "SQL must be marked NOT APPLIED");
  assert.ok(/^\s*begin;/i.test(code), "SQL must start its transaction explicitly");
  assert.ok(/rollback;\s*$/i.test(code), "SQL must end in ROLLBACK");
  assert.ok(!/(?:^|;)\s*commit\b|\\(?:i|include)|\bdblink\b/i.test(code), "no commit or remote/include escape");
  for (const file of readdirSync(new URL("supabase/migrations/", root))) {
    const migration = read(`supabase/migrations/${file}`);
    assert.ok(!/issue[-_ ]?27|myastoriya_google_sheet_sync_key|vault\.decrypted_secrets/i.test(migration),
      "issue 27 Vault design must not be an automatic migration");
  }
  assert.ok(!/myastoriya_google_sheet_sync_key|vault\.decrypted_secrets/i.test(read("supabase/schema.sql")),
    "schema bootstrap must not apply the design");
});

test("all fail-closed preconditions precede the first planned secret write", () => {
  const write = code.indexOf("v_secret_id := vault.create_secret(");
  assert.ok(write > 0, "planned Vault creation must exist");
  const preconditions = code.slice(0, write);
  for (const gate of [
    "lock table cron.job in share row exclusive mode",
    "lock table public.bi_runtime_config in share mode",
    "lock table vault.secrets in share row exclusive mode",
    "jobname = 'myastoriya_google_sheet_sync_daily' or jobid = 1",
    "jobname = 'myastoriya_google_sheet_sync_daily' and jobid = 1",
    "v_count <> 1", "v_before.schedule is distinct from '15 4 * * *'",
    "v_before.active is distinct from true", "v_before.database is distinct from current_database()",
    "regexp_matches(v_before.command, v_pattern, 'g')",
    "length(v_candidate) <> 26", "position(chr(92) in v_candidate) > 0",
    "current_setting('standard_conforming_strings') <> 'on'",
    "value_hash into strict v_expected_hash", "config_key = 'sync_key'",
    "encode(extensions.digest(v_candidate, 'sha256'), 'hex')",
    "v_expected_hash is null or v_candidate_hash is distinct from v_expected_hash",
    "exists (select 1 from vault.secrets where name = v_name)",
    "aclexplode", "a.grantee = 0", "p.grantee = 0",
    "has_any_column_privilege", "pg_has_role(v_role.oid, privileged.oid, 'MEMBER')",
    "'public.bi_trigger_sync(text)'::regprocedure", "and prosecdef",
    "array[v_before.username::name, v_manual_owner]",
    "has_schema_privilege(v_execution_role, 'vault', 'USAGE')",
    "has_table_privilege(v_execution_role, 'vault.decrypted_secrets', 'SELECT')",
  ]) includes(preconditions, gate, "required pre-write security gate is missing");
  assert.ok((preconditions.match(/if v_count <> 1 then/g) ?? []).length === 3,
    "job, header and extraction cardinality must each fail closed");
  assert.ok(!/\bgrant\b|\brevoke\b|\bcreate\s+(?:or\s+replace\s+)?function\b/i.test(code),
    "design must not grant access or introduce privileged wrappers");
});

test("rewrite changes one literal and preserves all cron and HTTP inputs", () => {
  includes(code, "v_lookup constant text := $lookup$(select decrypted_secret from vault.decrypted_secrets where name = 'myastoriya_google_sheet_sync_key')$lookup$", "lookup must select only the stable named Vault secret");
  includes(code, "position('vault.' in lower(v_before.command)) > 0", "reject pre-existing Vault references");
  includes(code, "(vault|decrypted_secrets)([^[:alnum:]_]|$)", "reject quoted, spaced and unqualified Vault references");
  includes(code, "position(v_name in v_before.command) > 0", "reject pre-existing secret-name references");
  includes(code, "replace(v_before.command, v_prefix || v_literal, v_prefix || v_lookup)", "replace only the extracted literal");
  includes(code, "position(v_candidate in v_new_command) > 0", "forbid plaintext in new command");
  includes(code, "is distinct from replace(v_new_command, v_prefix || v_lookup, '<redacted>')", "require byte preservation outside replacement");
  includes(code, "/ length(v_lookup) <> 1", "require exactly one lookup");
  includes(code, "perform cron.alter_job(job_id := v_before.jobid, command := v_new_command);", "only command may be altered");
  includes(code, "(to_jsonb(v_before) - 'command') is distinct from (to_jsonb(v_after) - 'command')", "verify every other metadata field");
  assert.ok((code.match(/perform cron\.alter_job\(/g) ?? []).length === 1);
  assert.ok(!/\bexecute\b|\bperform\s+net\.|\bselect\s+net\.|\bcron\.(?:schedule|unschedule)\s*\(|\balter\s+extension\b|\bcreate\s+extension\b/i.test(code),
    "design must not execute HTTP, reschedule jobs or relocate extensions");
});

test("recovery uses the verified Vault value and exposes only hashes and metadata", () => {
  includes(code, "select decrypted_secret into strict v_vault_candidate", "Vault read-back must be strict");
  includes(code, "where id = v_secret_id and name = v_name", "read back only the inserted named secret");
  includes(code, "extensions.digest(v_vault_candidate, 'sha256')", "verify Vault round-trip hash");
  includes(code, "replace(v_new_command, v_lookup, quote_literal(v_vault_candidate))", "prepare inverse without a plaintext backup");
  includes(code, "v_recovered_command is distinct from v_before.command", "verify exact recovery");
  assert.ok(!/raise\s+(?:notice|info|log|warning)|\bsqlerrm\b|\bsqlstate\b|\breturn\s+query\b/i.test(code), "no secret-bearing diagnostic sinks");
  assert.ok(!/raise\s+exception[^;]*%/i.test(code), "exceptions must not interpolate values");
  includes(code, "exception when others then", "native errors must be masked");
  includes(code, "select metadata from pg_temp.issue_27_validation;", "only approved metadata may be returned");
  const output = code.slice(code.indexOf("insert into pg_temp.issue_27_validation"), code.indexOf("exception when others"));
  const redactedOutput = output.replace(/encode\(extensions\.digest\(v_(?:before\.command|new_command), 'sha256'\), 'hex'\)/g, "HASH");
  assert.ok(!/\bv_candidate\b|\bv_vault_candidate\b|\bv_literal\b|\bv_recovered_command\b|\bv_before\.command\b|\bv_new_command\b/.test(redactedOutput),
    "evidence must not return plaintext commands or secret values");
  for (const setting of ["log_statement = 'none'", "log_min_error_statement = 'panic'", "log_parameter_max_length = 0", "log_parameter_max_length_on_error = 0", "pgaudit.log", "auto_explain.log_min_duration"]) {
    includes(code, setting, "logging safeguard is missing");
  }
  assert.ok(!/\bdelete\s+from\s+vault\.|\bvault\.update_secret\(/i.test(code), "never delete or rotate an existing secret");
});

test("unchanged Edge Function path is documented without claiming live validation", () => {
  const edge = read("supabase/functions/sync-google-sheet/index.ts");
  for (const fragment of ['req.headers.get("x-bi-sync-key")', '.eq("config_key", "sync_key")', '(await sha256Hex(presentedSyncKey)) !== syncConfig.value_hash', 'status: 401']) {
    includes(edge, fragment, "existing Edge authentication contract changed; review required");
  }
  for (const fragment of ["Barbara", "Kostiantyn", "including local SQL", "No executable recovery/apply path", "asynchronous", "already running", "external log redaction", "pg_net", "non-relocatable", "pre-change", "No plaintext backup"]) {
    includes(doc, fragment, "review, validation or recovery limitation is missing");
  }
});
