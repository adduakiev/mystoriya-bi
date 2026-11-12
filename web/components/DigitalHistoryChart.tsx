"use client";

import { ga4Money, GA4_MONEY_NOTICE } from "@/lib/ga4-presentation";
import { historyCumulative, metricNumber } from "@/lib/digital-quality";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { DigitalMonthlyRow } from "@/lib/data/digital";

type Metric = "sessions" | "purchases" | "revenue" | "conversionRate" | "seoClicks" | "seoCtr";
type Mode = "monthly" | "ytd";

const MONTHS=["Січ","Лют","Бер","Кві","Тра","Чер","Лип","Сер","Вер","Жов","Лис","Гру"];

const CONFIG: Record<Metric,{label:string;rate?:boolean;money?:boolean}> = {
  sessions:{label:"Сесії"},
  purchases:{label:"Purchase GA4"},
  revenue:{label:"Revenue GA4",money:true},
  conversionRate:{label:"Конверсія",rate:true},
  seoClicks:{label:"SEO кліки"},
  seoCtr:{label:"SEO CTR",rate:true}
};

function format(raw:unknown,metric:Metric){
  if(CONFIG[metric].money) return ga4Money(raw);
  const value=metricNumber(raw);
  if(value===null)return "—";
  if(CONFIG[metric].rate) return `${(value*100).toFixed(2)}%`;
  return Math.round(value).toLocaleString("uk-UA");
}

export function DigitalHistoryChart({rows,currentYear,cutoffMonth,cutoffDay}:{rows:DigitalMonthlyRow[];currentYear:number;cutoffMonth:number;cutoffDay:number}) {
  const [metric,setMetric]=useState<Metric>("sessions");
  const [mode,setMode]=useState<Mode>("monthly");

  const data=useMemo(()=>{
    const years=[...new Set(rows.map(r=>r.year))].sort();
    const byYear=new Map<number,DigitalMonthlyRow[]>();
    years.forEach(year=>byYear.set(year,rows.filter(r=>r.year===year).sort((a,b)=>a.month-b.month)));

    const cumulative=new Map<number,Record<number,number|null>>();
    years.forEach(year=>cumulative.set(year,historyCumulative(byYear.get(year)??[],metric)));

    return Array.from({length:12},(_,i)=>{
      const month=i+1;
      const point:Record<string,string|number|null>={month:MONTHS[i]};
      for(const year of years){
        const row=(byYear.get(year)??[]).find(r=>r.month===month);
        point[String(year)]=mode==="ytd"
          ? cumulative.get(year)?.[month]??null
          : row?.[metric]??null;
      }
      return point;
    });
  },[rows,metric,mode]);

  const years=[...new Set(rows.map(r=>r.year))].sort();

  return <div>
    <div className="digital-history-toolbar">
      <div className="metric-switcher">
        {(Object.keys(CONFIG) as Metric[]).map(key=>(
          <button key={key} type="button" className={`metric-pill ${metric===key?"active":""}`} onClick={()=>setMetric(key)}>
            {CONFIG[key].label}
          </button>
        ))}
      </div>
      <div className="segmented">
        <button type="button" className={`segment ${mode==="monthly"?"active":""}`} onClick={()=>setMode("monthly")}>По місяцях</button>
        <button type="button" className={`segment ${mode==="ytd"?"active":""}`} onClick={()=>setMode("ytd")}>Накопичення YTD</button>
      </div>
    </div>
    {CONFIG[metric].money ? <p>{GA4_MONEY_NOTICE}</p> : <ResponsiveContainer width="100%" height={330}>
      <LineChart data={data}>
        <CartesianGrid stroke="#222833" vertical={false}/>
        <XAxis dataKey="month" stroke="#77808f" tickLine={false} axisLine={false}/>
        <YAxis stroke="#77808f" tickLine={false} axisLine={false} width={70} tickFormatter={v=>format(v,metric)}/>
        <Tooltip
          formatter={(raw,name)=>[format(raw,metric),String(name)]}
          contentStyle={{background:"#111720",border:"1px solid #29313d",borderRadius:12}}
        />
        {years.map((year,index)=>(
          <Line
            key={year}
            type="monotone"
            dataKey={String(year)}
            name={String(year)}
            stroke={index===years.length-1?"#f5a623":"#758191"}
            strokeWidth={index===years.length-1?3:2}
            strokeDasharray={index===years.length-1?undefined:"5 4"}
            connectNulls={false}
            dot={false}
            activeDot={{r:4}}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>}
    <small className="table-note">
      {currentYear} · поточний місяць зіставлено до {cutoffDay} числа. Показники без історії залишаються порожніми, а не перетворюються на нулі.
    </small>
  </div>;
}
