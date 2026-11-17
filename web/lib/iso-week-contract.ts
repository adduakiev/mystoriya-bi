export const ISO_WEEK_CONTRACT = "iso-year-week-elapsed-days-v1";
export const isoWeeksEnabled = () => process.env.BI_ISO_WEEKS_V1 === "1";

export type IsoWeekMeta = {
  weeklyContract?: string;
  weeklyYears?: Array<number | string>;
  weeklyCutoff?: string | null;
  weeklyCalendarPartial?: boolean | null;
  years?: Array<number | string>;
};
export type IsoWeeklyReport = {
  years: number[];
  cutoff: string;
  partial: boolean;
  series: Array<Record<string, string | number | null>>;
};

export function isoWeekParts(date: Date): {year:number;week:number} {
  const thursday=new Date(date.getTime());
  thursday.setUTCDate(thursday.getUTCDate()+4-(thursday.getUTCDay()||7));
  const year=thursday.getUTCFullYear();
  const start=new Date(Date.UTC(year,0,1));
  return {year,week:Math.ceil(((thursday.getTime()-start.getTime())/86400000+1)/7)};
}

// Reject the legacy YEAR+WEEK response even if somebody enables the UI flag early.
// Numeric zero is observed zero; null is an absent observation and stays null.
export function readIsoWeeklyReport(meta:IsoWeekMeta|undefined,input:unknown):IsoWeeklyReport {
  const fail=():never=>{throw new Error("ISO_WEEK_CONTRACT_UNAVAILABLE");};
  if (!isoWeeksEnabled() || meta?.weeklyContract!==ISO_WEEK_CONTRACT) return fail();
  const cutoff=meta.weeklyCutoff;
  if(typeof cutoff!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff))return fail();
  const date=new Date(`${cutoff}T00:00:00Z`);
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==cutoff)return fail();
  const current=isoWeekParts(date);
  const rawYears=meta.weeklyYears ?? meta.years;
  if(!Array.isArray(rawYears)||!rawYears.length)return fail();
  const years=rawYears.map(Number);
  if(years.some(y=>!Number.isInteger(y)||y<1900||y>9999)||new Set(years).size!==years.length||!years.includes(current.year))return fail();
  years.sort((a,b)=>a-b);
  if(years[years.length-1]!==current.year || !Array.isArray(input)||input.length!==current.week)return fail();
  const partial=(date.getUTCDay()||7)<7;
  if(meta.weeklyCalendarPartial!==partial)return fail();
  const series=input.map((point,index)=>{
    if(!point||typeof point!=="object"||Array.isArray(point)||point.label!==`W${String(index+1).padStart(2,"0")}`)return fail();
    const keys=Object.keys(point).filter(k=>k!=="label");
    if(keys.length!==years.length||years.some(y=>!Object.hasOwn(point,String(y))))return fail();
    const normalized:Record<string,string|number|null>={label:point.label};
    for(const year of years){
      const value=point[String(year)];
      if(index+1>isoWeekParts(new Date(Date.UTC(year,11,28))).week && value!==null)return fail();
      if(value===null){normalized[String(year)]=null;continue;}
      if((typeof value!=="number"&&typeof value!=="string")||String(value).trim()===""||!Number.isFinite(Number(value)))return fail();
      normalized[String(year)]=Number(value);
    }
    return normalized;
  });
  return {years,cutoff,partial,series};
}
