import { unstable_cache } from "next/cache";
import { callBiRpc } from "@/lib/data/source";
import { normalizeDigital, normalizeHistory, selectSeoSnapshots, type DigitalData, type DigitalHistory } from "@/lib/digital-contract";
export type * from "@/lib/digital-contract";
type Raw = Record<string, any>;

const cachedPeriod = unstable_cache(
  async (from: string, to: string): Promise<DigitalData> => {
    const args: Record<string, unknown> = {};
    if (from) args.p_from = from;
    if (to) args.p_to = to;
    const data = normalizeDigital(await callBiRpc<Raw>("bi_digital_payload", args));
    if ((from && data.meta.from !== from) || (to && data.meta.to !== to)) {
      throw new Error("Digital RPC returned a different period");
    }
    return data;
  },
  ["digital-dashboard-correctness-v3"],
  { revalidate: 300, tags: ["digital-data"] }
);

const cachedHistory = unstable_cache(
  async (): Promise<DigitalHistory> =>
    normalizeHistory(await callBiRpc<Raw>("bi_digital_history_payload")),
  ["digital-history-correctness-v3"],
  { revalidate: 300, tags: ["digital-data"] }
);

export async function loadDigitalData(range?: {from?: string; to?: string}): Promise<DigitalData> {
  return cachedPeriod(range?.from ?? "", range?.to ?? "");
}

export async function loadDigitalHistory(): Promise<DigitalHistory> {
  return cachedHistory();
}

export async function loadSeoSnapshots(data: DigitalData, history: DigitalHistory) {
  return selectSeoSnapshots(data, history, loadDigitalData);
}
