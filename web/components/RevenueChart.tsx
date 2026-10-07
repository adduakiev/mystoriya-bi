"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { trend } from "@/lib/metrics";

export function RevenueChart() {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={trend}>
          <defs>
            <linearGradient id="currentFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5a623" stopOpacity={0.36} />
              <stop offset="100%" stopColor="#f5a623" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#222833" vertical={false} />
          <XAxis dataKey="month" stroke="#77808f" tickLine={false} axisLine={false} />
          <YAxis stroke="#77808f" tickLine={false} axisLine={false} width={32} />
          <Tooltip
            contentStyle={{ background: "#111720", border: "1px solid #29313d", borderRadius: 12 }}
          />
          <Area type="monotone" dataKey="previous" stroke="#68717e" fill="transparent" strokeWidth={2} />
          <Area type="monotone" dataKey="current" stroke="#f5a623" fill="url(#currentFill)" strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
