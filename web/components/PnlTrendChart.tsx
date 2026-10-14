"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type PnlTrendRow = {
  label: string;
  revenueFact: number;
  revenuePlan: number;
  revenueLy: number;
  profitFact: number;
  profitPlan: number;
  profitLy: number;
  markupFact: number;
  markupPlan: number;
  markupLy: number;
  markupRateFact: number;
  markupRatePlan: number;
  markupRateLy: number;
  profitRateFact: number;
  profitRatePlan: number;
  profitRateLy: number;
};

type Metric = "revenue" | "markup" | "profit" | "markupRate" | "profitRate";

const METRICS: Record<Metric, {
  label:string;
  fact:keyof PnlTrendRow;
  plan:keyof PnlTrendRow;
  ly:keyof PnlTrendRow;
  rate?:boolean;
}> = {
  revenue:{label:"Виручка",fact:"revenueFact",plan:"revenuePlan",ly:"revenueLy"},
  markup:{label:"Валовий прибуток",fact:"markupFact",plan:"markupPlan",ly:"markupLy"},
  profit:{label:"EBITDA",fact:"profitFact",plan:"profitPlan",ly:"profitLy"},
  markupRate:{label:"Валова маржа %",fact:"markupRateFact",plan:"markupRatePlan",ly:"markupRateLy",rate:true},
  profitRate:{label:"EBITDA %",fact:"profitRateFact",plan:"profitRatePlan",ly:"profitRateLy",rate:true}
};

function formatMoney(value:number){
  const abs=Math.abs(value);
  if(abs>=1_000_000) return `₴ ${(value/1_000_000).toFixed(1)}M`;
  if(abs>=1_000) return `₴ ${Math.round(value/1_000)}K`;
  return `₴ ${Math.round(value).toLocaleString("uk-UA")}`;
}

export function PnlTrendChart({data}:{data:PnlTrendRow[]}) {
  const [metric,setMetric]=useState<Metric>("profit");
  const config=METRICS[metric];

  const latest=useMemo(()=>data[data.length-1], [data]);
  const latestFact=latest ? Number(latest[config.fact] ?? 0) : 0;
  const latestPlan=latest ? Number(latest[config.plan] ?? 0) : 0;

  return (
    <div className="pnl-dynamics">
      <div className="pnl-dynamics-toolbar">
        <div className="metric-switcher">
          {(Object.keys(METRICS) as Metric[]).map((key)=>(
            <button
              key={key}
              type="button"
              className={`metric-pill ${metric===key?"active":""}`}
              onClick={()=>setMetric(key)}
            >
              {METRICS[key].label}
            </button>
          ))}
        </div>
        <div className="pnl-chart-latest">
          <span>Останній місяць</span>
          <b>{config.rate ? `${(latestFact*100).toFixed(1)}%` : formatMoney(latestFact)}</b>
          <small>План: {config.rate ? `${(latestPlan*100).toFixed(1)}%` : formatMoney(latestPlan)}</small>
        </div>
      </div>

      <div className="chart-wrap pnl-main-chart">
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={data}>
            <CartesianGrid stroke="#222833" vertical={false} />
            <XAxis dataKey="label" stroke="#77808f" tickLine={false} axisLine={false} />
            <YAxis
              stroke="#77808f"
              tickLine={false}
              axisLine={false}
              width={66}
              tickFormatter={(raw)=>{
                const value=Number(raw);
                if(config.rate) return `${(value*100).toFixed(0)}%`;
                if(Math.abs(value)>=1_000_000) return `${(value/1_000_000).toFixed(1)}M`;
                return `${Math.round(value/1_000)}K`;
              }}
            />
            <Tooltip
              formatter={(raw,name)=>{
                const value=Number(raw);
                return [
                  config.rate ? `${(value*100).toFixed(1)}%` : `₴ ${Math.round(value).toLocaleString("uk-UA")}`,
                  String(name)
                ];
              }}
              contentStyle={{
                background:"#111720",
                border:"1px solid #29313d",
                borderRadius:12
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={config.ly as string}
              name="2025"
              stroke="#68717e"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey={config.plan as string}
              name="План 2026"
              stroke="#61a9ff"
              strokeWidth={2}
              strokeDasharray="7 5"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey={config.fact as string}
              name="Факт 2026"
              stroke="#f5a623"
              strokeWidth={3}
              dot={false}
              activeDot={{r:4}}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
