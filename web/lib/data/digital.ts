import { unstable_cache } from "next/cache";
import { callBiRpc } from "@/lib/data/source";

import { normalizeDigital, normalizeDigitalHistory, selectDigitalSnapshots, type DigitalData, type DigitalHistory } from "./digital-contract";
export type * from "./digital-contract";

type Raw = Record<string, any>;

const cachedPeriod = unstable_cache(
  async (from: string, to: string): Promise<DigitalData> => {
    const args: Record<string, unknown> = {};
    if (from) args.p_from = from;
    if (to) args.p_to = to;
    return normalizeDigital(await callBiRpc<Raw>("bi_digital_payload", args));
  },
  ["digital-dashboard-correctness-v3"],
  { revalidate: 300, tags: ["digital-data"] }
);

const cachedHistory = unstable_cache(
  async (): Promise<DigitalHistory> =>
    normalizeDigitalHistory(await callBiRpc<Raw>("bi_digital_history_payload")),
  ["digital-history-correctness-v2"],
  { revalidate: 300, tags: ["digital-data"] }
);

export async function loadDigitalData(range?: {from?: string; to?: string}): Promise<DigitalData> {
  return cachedPeriod(range?.from ?? "", range?.to ?? "");
}

export async function loadDigitalHistory(): Promise<DigitalHistory> {
  return cachedHistory();
}

/** Only known snapshot dates are discoverable through the legacy history RPC. */
export async function loadSeoSnapshots(data: DigitalData, history: DigitalHistory) {
  return selectDigitalSnapshots(data, history, loadDigitalData);
}
