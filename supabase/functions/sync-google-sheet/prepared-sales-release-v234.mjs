// D234 PREPARE ONLY. Private server module; no HTTP handler, DB writer or env reads.
import { createPreparedSalesCutover } from './prepared-sales-cutover.mjs';
import { verifyPreparedSalesProvenance } from './prepared-sales-provenance.mjs';
const fail = code => { throw new Error(`SALES_RELEASE_V234_${code}`); };

/** Pinned configuration belongs to trusted server/reviewer code, NEVER a request.
 * Even valid signatures authenticate observations only. No approved production
 * historical genesis / DB attestor channel exists; this adapter cannot release.
 * Results contain private source evidence: never log, persist or serve to a UI.
 */
export function createPreparedSalesReleaseV234(config = {}) {
  if (typeof window !== 'undefined' || config.enabled !== true) fail('DISABLED');
  const { pinnedRootSha256, trustedContext, ...captureConfig } = config;
  if (typeof pinnedRootSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(pinnedRootSha256) ||
      trustedContext?.priorReceiptSha256 !== pinnedRootSha256 || trustedContext?.prior?.kind !== 'atomic-accepted/v1' ||
      !(trustedContext.observers instanceof Map) || trustedContext.observers.size !== 2) fail('PINNED_PRIOR_AND_SIGNERS_REQUIRED');
  const trusted = structuredClone(trustedContext);
  const aliases = structuredClone(captureConfig.aliases);
  const reader = createPreparedSalesCutover(captureConfig);
  async function prepare({ evidence, now, signal } = {}) {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('CLOCK');
    // Copy before any await; caller mutation cannot replace policy/evidence.
    const clock = new Date(now.getTime()), signed = structuredClone(evidence);
    try {
      const first = await reader.review({ now: clock, signal });
      const second = await reader.review({ now: clock, signal });
      const verified = await verifyPreparedSalesProvenance({ evidence: signed,
        first: first.observation.capture, second: second.observation.capture,
        aliases, trustedContext: trusted, now: clock });
      if (signal?.aborted) fail('ABORTED');
      return Object.freeze({ status: 'BLOCKED', code: 'SALES_RELEASE_V234_PRODUCTION_ROOT_AND_DB_ATTESTOR_NOT_APPROVED',
        released: false, verified, first, second });
    } catch { fail(signal?.aborted ? 'ABORTED' : 'PREPARATION_FAILED'); }
  }
  async function release() { fail('PRODUCTION_ROOT_AND_DB_ATTESTOR_NOT_APPROVED'); }
  return Object.freeze({ prepare, release });
}
