"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { DigitalTrendRow } from "@/lib/data/digital";

type Metric = "sessions" | "purchases" | "clicks";

const CONFIG: Record<Metric,{label:string;key:keyof DigitalTrendRow}> = {
  sessions:{label:"Сесії",key:"sessions"},
  purchases:{label:"Покупки GA4",key:"purchases"},
  clicks:{label:"SEO кліки",key:"clicks"}
};

export function DigitalTrendChart({data}:{data:DigitalTrendRow[]}) {
  const [metric,setMetric]=useState<Metric>("sessions");
  const config=CONFIG[metric];

  return (
    <div>
      <div className="metric-switcher" style={{justifyContent:"flex-start",marginBottom:12}}>
        {(Object.keys(CONFIG) as Metric[]).map(key=>(
          <button
            key={key}
            type="button"
            className={`metric-pill ${metric===key?"active":""}`}
            onClick={()=>setMetric(key)}
          >
            {CONFIG[key].label}
          </button>
        ))}
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid stroke="#222833" vertical={false}/>
            <XAxis dataKey="date" stroke="#77808f" tickLine={false} axisLine={false} tickFormatter={v=>String(v).slice(5)}/>
            <YAxis stroke="#77808f" tickLine={false} axisLine={false} width={56}/>
            <Tooltip
              formatter={raw=>Number(raw).toLocaleString("uk-UA")}
              labelFormatter={label=>String(label)}
              contentStyle={{background:"#111720",border:"1px solid #29313d",borderRadius:12}}
            />
            <Line type="monotone" dataKey={config.key as string} name={config.label} stroke="#f5a623" strokeWidth={3} dot={false} activeDot={{r:4}}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
