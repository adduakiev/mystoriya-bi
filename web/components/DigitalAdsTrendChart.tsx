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
import type { DigitalAdsData } from "@/lib/data/digital-sources";

type Row=DigitalAdsData["trend"][number];
type Metric="cost"|"conversionValue"|"clicks"|"conversions";

const CONFIG:Record<Metric,{label:string;money?:boolean}>={
  cost:{label:"Spend",money:true},
  conversionValue:{label:"Conversion value",money:true},
  clicks:{label:"Clicks"},
  conversions:{label:"Conversions"}
};

function format(v:number,m:Metric){
  if(CONFIG[m].money){
    if(Math.abs(v)>=1000) return `₴${(v/1000).toFixed(1)}K`;
    return `₴${Math.round(v)}`;
  }
  return v.toLocaleString("uk-UA",{maximumFractionDigits:1});
}

export function DigitalAdsTrendChart({data}:{data:Row[]}){
  const [metric,setMetric]=useState<Metric>("cost");
  return <div>
    <div className="metric-switcher" style={{justifyContent:"flex-start",marginBottom:12}}>
      {(Object.keys(CONFIG) as Metric[]).map(key=><button
        key={key}
        type="button"
        className={`metric-pill ${metric===key?"active":""}`}
        onClick={()=>setMetric(key)}
      >{CONFIG[key].label}</button>)}
    </div>
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid stroke="#222833" vertical={false}/>
          <XAxis dataKey="date" stroke="#77808f" tickLine={false} axisLine={false} tickFormatter={v=>String(v).slice(5)}/>
          <YAxis stroke="#77808f" tickLine={false} axisLine={false} width={64} tickFormatter={v=>format(Number(v),metric)}/>
          <Tooltip
            formatter={raw=>format(Number(raw),metric)}
            labelFormatter={label=>String(label)}
            contentStyle={{background:"#111720",border:"1px solid #29313d",borderRadius:12}}
          />
          <Line type="monotone" dataKey={metric} name={CONFIG[metric].label} stroke="#f5a623" strokeWidth={3} dot={false} activeDot={{r:4}}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>;
}
