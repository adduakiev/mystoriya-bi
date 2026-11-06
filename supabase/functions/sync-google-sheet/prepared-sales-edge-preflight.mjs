// D253 OFFLINE ONLY. No imports, I/O, credentials, packet handling or authority.
// This checks a review contract; it cannot inspect or replace an installed Edge.
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export const SALES_EDGE_GATES = freeze([
  'serverOnlyReadonlyCredentialPresence',
  'ownerApprovedHistoricalGenesisRoot',
  'independentEd25519FingerprintToAuthenticatedSqlLogin',
  'exactShaAtomicSqlPg16',
  'exactShaAtomicSqlPg17',
  'protectedProductionBackupRestore',
  'compatibleEdgeSwapAndSafeRollback',
  'privateSourceWarehouseRpcUiParity',
  'authenticatedDesktopQa',
  'authenticatedMobileQa',
  'ownerApprovedRelease'
]);

// Installed-v9 facts are supplied by the trusted D253 read-only observation,
// not inferred from this repository's different, sealed entrypoint.
export const SALES_EDGE_OFFLINE_CONTRACT = freeze({
  kind: 'sales-edge-v9-to-v234/OFFLINE_ONLY',
  installed: {
    version: 9, state: 'ACTIVE_UNSAFE_DO_NOT_INVOKE', batchSize: 2000,
    source: 'unauthenticated-gviz',
    writers: { batch: 'sync_sales_batch', finalize: 'finalize_sales_snapshot' }
  },
  repository: { edgePost: 503, nextPost: 503, refreshEnabled: false },
  replacement: {
    state: 'SEALED_PREPARATION_ONLY', source: 'server-only-oauth-sheets-readonly',
    transaction: 'v234-all-or-nothing-PG16-PG17-required',
    legacyFallback: false, staleDeletion: false, partialBatchWrites: false,
    manualRefreshEnabled: false, releaseEnabled: false,
    // These are review constraints, not executable routing or a deployment flag.
    outcomes: { success: 503, error: 503, timeout: 503, retry: 503,
      unknownSource: 503, abort: 503, authFailure: 503, partialRead: 503 },
    successMeans: 'BLOCKED_NOT_IMPORTED_NOT_VIEW_REFRESHED',
    rollback: 'SEALED_503_NEVER_REACTIVATE_V9'
  },
  confidentiality: { log: false, artifact: false, api: false }
});

// Reject unknown/non-enumerable/symbol keys and accessors without reading them.
// Only plain metadata belongs here; never pass credentials, cells or packets.
function fields(value, keys) {
  if (!value || typeof value !== 'object' ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw 0;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const own = Reflect.ownKeys(descriptors);
  if (own.length !== keys.length || own.some(key => !keys.includes(key))) throw 0;
  for (const key of keys) if (!Object.hasOwn(descriptors[key], 'value')) throw 0;
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}

function matches(value, expected) {
  if (expected && typeof expected === 'object') {
    const data = fields(value, Object.keys(expected));
    for (const key of Object.keys(expected)) matches(data[key], expected[key]);
  } else if (value !== expected) throw 0;
}

/** Standalone review metadata only. A declaration is NEVER verified evidence.
 * No signature, synthetic fixture, caller boolean, JWT or service role can open
 * a gate. Real evidence must be independently reviewed outside this module.
 * Output is fixed vocabulary only; input and exception details are never echoed.
 */
export function verifyOfflineSalesEdgePreflight(input) {
  let contractValid = false;
  let states = Object.fromEntries(SALES_EDGE_GATES.map(key => [key, 'MISSING']));
  try {
    if (typeof window !== 'undefined') throw 0;
    const data = fields(input, ['contract', 'evidence']);
    matches(data.contract, SALES_EDGE_OFFLINE_CONTRACT);
    const evidence = fields(data.evidence, SALES_EDGE_GATES);
    for (const key of SALES_EDGE_GATES) {
      if (!['MISSING', 'DECLARED_UNVERIFIED'].includes(evidence[key])) throw 0;
    }
    states = evidence;
    contractValid = true;
  } catch { /* Deliberately discard even hostile exception text. */ }
  return freeze({
    status: 'BLOCKED', code: contractValid ? 'REAL_AUTHORITY_NOT_VERIFIED' : 'INVALID_OFFLINE_CONTRACT',
    contractValid, productionVerified: false, readyForGate: false,
    manualRefreshEnabled: false, releaseEnabled: false, requiredHttpStatus: 503,
    gates: SALES_EDGE_GATES.map(id => ({ id, state: 'HARD_CLOSED', evidence: states[id] }))
  });
}
