// Owner-run, one-shot READ ONLY. Never an Edge/import entrypoint or scheduler.
// Importing this module reads no environment and makes no requests.
import { pathToFileURL } from 'node:url';
import { probePrivateSalesHeader } from '../supabase/functions/sync-google-sheet/private-sales-header-probe.mjs';

/** Dependencies are trusted server code, never HTTP input. The CLI opt-in is an
 * accident guard, not owner authorization. Only the sanitized probe result exits.
 */
export async function runPrivateSalesHeaderProbe(args, { readSecret, fetchImpl } = {}) {
  const failed = () => Object.freeze({ code: 'FAIL', timestamp: new Date().toISOString() });
  if (!Array.isArray(args) || args.length !== 1 || args[0] !== '--read-only' ||
      typeof readSecret !== 'function' || typeof fetchImpl !== 'function' ||
      typeof window !== 'undefined' || typeof document !== 'undefined') return failed();
  try {
    // An existing owner-provisioned secret only: no discovery, exports, arguments,
    // files, DB client or fallback. Never log the value or exception/cause.
    return await probePrivateSalesHeader(readSecret('GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON'), { fetchImpl });
  } catch { return failed(); }
}

export async function privateSalesHeaderProbeCli(args, dependencies, write) {
  const result = await runPrivateSalesHeaderProbe(args, dependencies);
  write(`${JSON.stringify(result)}\n`);
  return result.code === 'PASS' ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await privateSalesHeaderProbeCli(process.argv.slice(2), {
    readSecret: name => process.env[name], fetchImpl: globalThis.fetch
  }, text => process.stdout.write(text));
}
