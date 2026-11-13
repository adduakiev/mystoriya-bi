import "server-only";
import { createHash } from "node:crypto";

/** Owner confirmation 2026-11-13. Evidence of export completeness, not an independent audit. */
export const GLOVO_MONTH_DIGESTS: Readonly<Record<string, string>> = Object.freeze({
  "2026-01": "2035ad6f110418522bdff1ad62e47423a8dc739726b33de68400844b79ad40e9",
  "2026-02": "d68fc6329c092432b87329f65fe71bddd088b97bb47988ff82b1bc1782a0d7a4",
  "2026-03": "11700f15f5625b391592dfc4b709ef533c969d60fec8fb993cfdc00020bae3a2",
  "2026-04": "651ec1deded3a722d788a108eba71385d4bff4eb80b0fedf27eb90b1eda513ee",
  "2026-05": "990b5ec4f9a5750bf71f88b0f0e97e314f7e92066a784167674cf769dbe2cdf1",
  "2026-06": "5bb061b318ace780128ee115bddf489e88662946f54433c843d5c9c398b93414",
  "2026-07": "201cfc9213b2467e45f9b64e75dfa90b26b020d3293f37a0fc0c7bc3c88eff21",
  "2026-08": "2b47b69194aca03da1cda34c9c8f613308d51c1c8a43e70b5ff571d325b60b4b",
  "2026-09": "370369eff2ef97968593b27b39f35b3baf946b4b849c6ee9436d39ac5381671d",
  "2026-10": "8260c879bcb0f07b25dc0d0f028611cf99b5cc5c27ca56c5ee80f1fb6892721f"
});
/** JSON array of native A:I rows, sorted by their JSON strings (UTF-16 code unit order).
 * Hash raw cells before mapping/normalization; lineage and missing cells participate. */
export function glovoMonthDigest(rows: readonly (readonly unknown[])[]): string {
  const sorted = rows.map(row => JSON.stringify(row)).sort().map(row => JSON.parse(row));
  return createHash("sha256").update(JSON.stringify(sorted), "utf8").digest("hex");
}
export function confirmGlovoMonths(values: readonly (readonly unknown[])[], expected = GLOVO_MONTH_DIGESTS) {
  const months = [...new Set(values.slice(1).filter(row => typeof row[0] === "string").map(row => row[0] as string))].sort();
  return months.map(month => {
    const digest = glovoMonthDigest(values.slice(1).filter(row => row[0] === month));
    return {month, digest, expectedDigest: expected[month] ?? null,
      status: expected[month] === digest ? "CONFIRMED" as const : expected[month] ? "CHANGED" as const : "UNCONFIRMED" as const};
  });
}
