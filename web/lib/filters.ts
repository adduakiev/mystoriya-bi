import type { SalesRow } from "@/lib/data/types";

export type DashboardFilters = {
  channel?: string;
  location?: string;
  brand?: string;
  ownership?: string;
};

export function filterSalesRows(rows: SalesRow[], filters: DashboardFilters): SalesRow[] {
  return rows.filter((row) => {
    if (filters.channel && row.channelGroup !== filters.channel) return false;
    if (filters.location && row.location !== filters.location) return false;
    if (filters.brand && row.brand !== filters.brand) return false;
    if (filters.ownership && row.ownership !== filters.ownership) return false;
    return true;
  });
}

export function uniqueFilterValues(rows: SalesRow[]) {
  const values = <K extends keyof Pick<SalesRow, "channelGroup" | "location" | "brand" | "ownership">>(key: K) =>
    [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uk"));

  return {
    channels: values("channelGroup"),
    locations: values("location"),
    brands: values("brand"),
    ownerships: values("ownership")
  };
}

export function queryHref(
  current: DashboardFilters,
  patch: Partial<Record<keyof DashboardFilters, string | undefined>>
): string {
  const next: DashboardFilters = { ...current, ...patch };
  const params = new URLSearchParams();

  if (next.channel) params.set("channel", next.channel);
  if (next.location) params.set("location", next.location);
  if (next.brand) params.set("brand", next.brand);
  if (next.ownership) params.set("ownership", next.ownership);

  const query = params.toString();
  return query ? `/?${query}` : "/";
}
