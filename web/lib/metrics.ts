export type Kpi = {
  label: string;
  value: string;
  delta: number;
  deltaLabel: string;
  hint?: string;
};

export const kpis: Kpi[] = [
  { label: "Оборот", value: "₴ 82.4M", delta: 16.8, deltaLabel: "YoY" },
  { label: "Чеки", value: "103,482", delta: 11.2, deltaLabel: "YoY" },
  { label: "Середній чек", value: "₴ 796", delta: 5.1, deltaLabel: "YoY" },
  { label: "Націнка", value: "₴ 41.7M", delta: 13.3, deltaLabel: "YoY" },
  { label: "Націнка %", value: "50.6%", delta: -1.5, deltaLabel: "pp YoY" }
];

export const trend = [
  { month: "Jan", current: 7.2, previous: 6.1 },
  { month: "Feb", current: 7.6, previous: 6.4 },
  { month: "Mar", current: 8.1, previous: 7.0 },
  { month: "Apr", current: 8.8, previous: 7.4 },
  { month: "May", current: 9.0, previous: 7.7 },
  { month: "Jun", current: 9.5, previous: 8.0 },
  { month: "Jul", current: 10.1, previous: 8.5 },
  { month: "Aug", current: 10.6, previous: 9.0 },
  { month: "Sep", current: 11.5, previous: 9.6 },
  { month: "Oct", current: 4.0, previous: 3.4 }
];

export const channels = [
  { name: "Заклади", share: 58.2, value: "₴47.9M" },
  { name: "Доставка", share: 19.7, value: "₴16.2M" },
  { name: "Агрегатори", share: 22.1, value: "₴18.2M" }
];

export const locations = [
  { name: "Івасюка", revenue: "₴12.8M", growth: 18.4, share: "15.5%" },
  { name: "Ахматової", revenue: "₴11.9M", growth: 9.7, share: "14.4%" },
  { name: "Голосіївський", revenue: "₴10.6M", growth: 21.5, share: "12.9%" },
  { name: "Рудницького", revenue: "₴9.8M", growth: -3.2, share: "11.9%" }
];
