// PREPARE ONLY. Confidential in-process review, never an HTTP handler or importer.
// No environment reads, signing policy, trust-root provisioning, storage or writes.
import { capturePreparedPrivateSalesSheet } from './prepared-sales-sheet-capture.mjs';
import { canonicalSalesSourceBytes, deriveSalesProvenance } from './prepared-sales-provenance.mjs';
import { createPreparedSalesTransport } from './prepared-sales-transport.mjs';

const fail = code => { throw new Error(`SALES_CUTOVER_${code}`); };
function options(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !allowed.includes(key))) fail('OPTIONS');
}

/** Explicit TRUSTED SERVER configuration only, never request data. This composes
 * typed private OAuth capture, exact-cent preparation, paginated warehouse reads
 * and provenance digest derivation. NONE of those authenticates the prior root.
 * aliases must be a complete independently reviewed mapping, not source guesses.
 * The result contains confidential source bytes/cells/bodies: never return it to
 * a browser, log, persist or publish it. Only a separately authorized reviewer
 * may consume it. No read is performed until review() is explicitly called.
 */
export function createPreparedSalesCutover(config = {}) {
  if (typeof window !== 'undefined' || config?.enabled !== true) fail('DISABLED');
  options(config, ['enabled', 'baseUrl', 'serviceRoleKey', 'sheetSecret', 'fetchImpl', 'aliases', 'timeoutMs']);
  const { baseUrl, serviceRoleKey, sheetSecret, fetchImpl, timeoutMs = 30000 } = config;
  if (typeof sheetSecret !== 'string' || typeof fetchImpl !== 'function' ||
      !Array.isArray(config.aliases) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) fail('OPTIONS');
  const aliases = structuredClone(config.aliases);
  // Validate fixed DB origin/auth shape without performing any I/O. JWT claims
  // are not signature verification or acceptance of Sales evidence.
  createPreparedSalesTransport({ enabled: true, baseUrl, serviceRoleKey, fetchImpl, timeoutMs });

  async function review(input = {}) {
    options(input, ['now', 'signal']);
    const now = input.now === undefined ? new Date() : new Date(input.now instanceof Date ? input.now.getTime() : NaN);
    const signal = input.signal;
    if (!Number.isFinite(now.getTime()) || (signal !== undefined && !(signal instanceof AbortSignal))) fail('OPTIONS');
    if (signal?.aborted) fail('ABORTED');
    // Per-invocation capture ownership: simultaneous reviews cannot exchange cells.
    let observation;
    const transport = createPreparedSalesTransport({ enabled: true, baseUrl, serviceRoleKey, fetchImpl, timeoutMs,
      readSourceImpl: async (_, { signal: captureSignal }) => {
        observation = await capturePreparedPrivateSalesSheet(sheetSecret, { fetchImpl, signal: captureSignal, timeoutMs });
        // Convert from the frozen typed canonical projection, never a second read
        // or JSON monetary number parse. Numeric tags already contain exact text.
        return JSON.parse(new TextDecoder().decode(canonicalSalesSourceBytes(observation.capture)))[8]
          .map(row => row.map(cell => cell[0] === 'blank' ? '' : cell[1]));
      } });
    try {
      const { baseline, prepared } = await transport.prepare({ now, signal });
      const provenance = await deriveSalesProvenance({ capture: observation.capture, aliases, previous: baseline, now });
      if (signal?.aborted) fail('ABORTED');
      if (provenance.sourceSha256 !== observation.sourceSha256 || provenance.manifestJson !== prepared.manifestJson) fail('BINDING');
      return Object.freeze({ status: 'BLOCKED', code: 'SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE',
        priorAuthenticated: false, baseline, observation, prepared, provenance });
    } catch (error) {
      // No upstream response, cells, credentials or exception causes leave here.
      fail(signal?.aborted || error?.message === 'SALES_CUTOVER_ABORTED' ? 'ABORTED' : 'REVIEW_FAILED');
    }
  }

  // This is also the proposed manual-refresh boundary. Neither reviewer JSON,
  // service_role, two caller-selected signers nor a UI request can open it.
  async function refresh() { fail('ATTESTOR_UNAVAILABLE'); }
  return Object.freeze({ review, refresh });
}
