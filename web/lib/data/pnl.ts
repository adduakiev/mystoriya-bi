import {
  PNL_SOURCE,
  PNL_SOURCE_META,
  type PnlSeriesKey
} from "@/lib/data/pnl-source";

export const PNL_MONTHS = ["Січ","Лют","Бер","Кві","Тра","Чер","Лип","Сер"] as const;
type Getter = (code: string) => number;

export type PnlCalculated = {
  revenue:number; cogs:number; markup:number; markupRate:number; operatingExpenses:number;
  profit:number; profitRate:number; reportedProfit:number; reportedGap:number;
  delivery:{revenue:number;cogs:number;markup:number;markupRate:number;marketingFot:number;media:number;agency:number;affiliate:number;marketingTotal:number;serviceOps:number;itDigital:number;logistics:number;acquiring:number;couriers:number;pasha:number;allocatedFot:number;opex:number;profit:number;profitRate:number;};
  aggregators:{revenue:number;cogs:number;markup:number;markupRate:number;commission:number;commissionRate:number;promo:number;promoRate:number;commissionPromoRate:number;getOrder:number;allocatedFot:number;opex:number;profit:number;profitRate:number;};
};

export type PnlDetailRow={section:string;label:string;kind:"income"|"expense"|"total"|"control";fact:number;plan:number;ly:number;note?:string;};

function safe(value:number|null|undefined){return Number.isFinite(Number(value))?Number(value??0):0;}
function sourceValue(code:string,key:PnlSeriesKey,monthIndex:number){return safe(PNL_SOURCE[code]?.[key]?.[monthIndex]);}
function sourceTotal(code:string,key:PnlSeriesKey,monthCount:number){
  const series=PNL_SOURCE[code]?.[key]??[];
  return series.slice(0,monthCount).reduce<number>((sum,value)=>sum+safe(value),0);
}

function calculate(get:Getter):PnlCalculated{
  const revenue=get("revenue_total");
  const deliveryRevenue=get("revenue_delivery"),deliveryCogs=get("cogs_delivery");
  const aggregatorRevenue=get("revenue_aggregators"),aggregatorCogs=get("cogs_aggregators");
  // Source row "Собівартість" already contains aggregator commission. For BI merchandise COGS,
  // use only channel COGS and keep commission once in Aggregators OPEX.
  const cogs=deliveryCogs+aggregatorCogs;
  const marketingFot=get("marketing_fot"),media=get("facebook")+get("google"),agency=get("agency"),affiliate=get("admitad");
  const marketingTotal=marketingFot+media+agency+affiliate;
  const serviceOps=get("email_esputnik")+get("turbo_sms_ai")+get("binotel");
  const itDigital=get("site_support")+get("webvizion")+get("dots");
  const logistics=get("uklon")+get("glovo_ondemand")+get("fuel")+get("taxi");
  const management=get("salary_kostiushko"),contactCenter=get("contact_center");
  const deliveryAllocatedFot=(management+contactCenter)*0.7,aggregatorAllocatedFot=(management+contactCenter)*0.3;
  const deliveryMarkup=deliveryRevenue-deliveryCogs,aggregatorMarkup=aggregatorRevenue-aggregatorCogs;
  const deliveryOpex=marketingTotal+serviceOps+itDigital+logistics+get("easypay")+get("couriers_freelance")+get("salary_nedogibchenko")+deliveryAllocatedFot;
  const commission=get("commission_total"),promo=get("aggregator_promo"),getOrder=get("getorder");
  const aggregatorOpex=commission+promo+getOrder+aggregatorAllocatedFot;
  const deliveryProfit=deliveryMarkup-deliveryOpex,aggregatorProfit=aggregatorMarkup-aggregatorOpex;
  const markup=deliveryMarkup+aggregatorMarkup,operatingExpenses=deliveryOpex+aggregatorOpex,profit=deliveryProfit+aggregatorProfit,reportedProfit=get("reported_profit");
  return {revenue,cogs,markup,markupRate:revenue?markup/revenue:0,operatingExpenses,profit,profitRate:revenue?profit/revenue:0,reportedProfit,reportedGap:profit-reportedProfit,
    delivery:{revenue:deliveryRevenue,cogs:deliveryCogs,markup:deliveryMarkup,markupRate:deliveryRevenue?deliveryMarkup/deliveryRevenue:0,marketingFot,media,agency,affiliate,marketingTotal,serviceOps,itDigital,logistics,acquiring:get("easypay"),couriers:get("couriers_freelance"),pasha:get("salary_nedogibchenko"),allocatedFot:deliveryAllocatedFot,opex:deliveryOpex,profit:deliveryProfit,profitRate:deliveryRevenue?deliveryProfit/deliveryRevenue:0},
    aggregators:{revenue:aggregatorRevenue,cogs:aggregatorCogs,markup:aggregatorMarkup,markupRate:aggregatorRevenue?aggregatorMarkup/aggregatorRevenue:0,commission,commissionRate:aggregatorRevenue?commission/aggregatorRevenue:0,promo,promoRate:aggregatorRevenue?promo/aggregatorRevenue:0,commissionPromoRate:aggregatorRevenue?(commission+promo)/aggregatorRevenue:0,getOrder,allocatedFot:aggregatorAllocatedFot,opex:aggregatorOpex,profit:aggregatorProfit,profitRate:aggregatorRevenue?aggregatorProfit/aggregatorRevenue:0}
  };
}
function period(key:PnlSeriesKey,monthCount=PNL_SOURCE_META.latestFactMonth){return calculate(code=>sourceTotal(code,key,monthCount));}
function month(key:PnlSeriesKey,index:number){return calculate(code=>sourceValue(code,key,index));}
function detailRow(section:string,label:string,kind:PnlDetailRow["kind"],fact:number,plan:number,ly:number,note?:string):PnlDetailRow{return {section,label,kind,fact,plan,ly,note};}

export function loadPnlData(){
  const fact=period("fact2026"),plan=period("plan2026"),ly=period("fact2025");
  const trend=PNL_MONTHS.map((label,index)=>{const current=month("fact2026",index),planned=month("plan2026",index),previous=month("fact2025",index);return {label,revenueFact:current.revenue,revenuePlan:planned.revenue,revenueLy:previous.revenue,profitFact:current.profit,profitPlan:planned.profit,profitLy:previous.profit,markupFact:current.markup,markupPlan:planned.markup,markupLy:previous.markup};});
  const details:PnlDetailRow[]=[
    detailRow("Виручка","Виручка всього","income",fact.revenue,plan.revenue,ly.revenue),
    detailRow("Виручка","Доставка","income",fact.delivery.revenue,plan.delivery.revenue,ly.delivery.revenue),
    detailRow("Виручка","Агрегатори","income",fact.aggregators.revenue,plan.aggregators.revenue,ly.aggregators.revenue),
    detailRow("Націнка","Собівартість товару","expense",fact.cogs,plan.cogs,ly.cogs),
    detailRow("Націнка","Націнка всього","total",fact.markup,plan.markup,ly.markup),
    detailRow("Націнка","Націнка Delivery","total",fact.delivery.markup,plan.delivery.markup,ly.delivery.markup),
    detailRow("Націнка","Націнка Aggregators до комісії","total",fact.aggregators.markup,plan.aggregators.markup,ly.aggregators.markup),
    detailRow("Агрегатори","Комісія агрегаторів","expense",fact.aggregators.commission,plan.aggregators.commission,ly.aggregators.commission),
    detailRow("Агрегатори","Просування в агрегаторах","expense",fact.aggregators.promo,plan.aggregators.promo,ly.aggregators.promo),
    detailRow("Агрегатори","GetOrder","expense",fact.aggregators.getOrder,plan.aggregators.getOrder,ly.aggregators.getOrder),
    detailRow("Агрегатори","30% Management + Contact Center","expense",fact.aggregators.allocatedFot,plan.aggregators.allocatedFot,ly.aggregators.allocatedFot),
    detailRow("Агрегатори","Результат Aggregators","total",fact.aggregators.profit,plan.aggregators.profit,ly.aggregators.profit),
    detailRow("Delivery · Marketing","Маркетинг ФОТ","expense",fact.delivery.marketingFot,plan.delivery.marketingFot,ly.delivery.marketingFot),
    detailRow("Delivery · Marketing","Facebook + Google","expense",fact.delivery.media,plan.delivery.media,ly.delivery.media),
    detailRow("Delivery · Marketing","Агенція","expense",fact.delivery.agency,plan.delivery.agency,ly.delivery.agency),
    detailRow("Delivery · Marketing","Admitad / affiliate","expense",fact.delivery.affiliate,plan.delivery.affiliate,ly.delivery.affiliate),
    detailRow("Delivery · OPEX","CRM / комунікації","expense",fact.delivery.serviceOps,plan.delivery.serviceOps,ly.delivery.serviceOps),
    detailRow("Delivery · OPEX","IT / сайт / сервери / app","expense",fact.delivery.itDigital,plan.delivery.itDigital,ly.delivery.itDigital,"З 04.2026 source-стаття містить також development нового сайту; у 2026 не перекласифіковуємо."),
    detailRow("Delivery · OPEX","Логістика","expense",fact.delivery.logistics,plan.delivery.logistics,ly.delivery.logistics),
    detailRow("Delivery · OPEX","EasyPay","expense",fact.delivery.acquiring,plan.delivery.acquiring,ly.delivery.acquiring),
    detailRow("Delivery · OPEX","Кур'єри + фріланс","expense",fact.delivery.couriers,plan.delivery.couriers,ly.delivery.couriers),
    detailRow("Delivery · OPEX","Недогибченко / Паша","expense",fact.delivery.pasha,plan.delivery.pasha,ly.delivery.pasha),
    detailRow("Delivery · OPEX","70% Management + Contact Center","expense",fact.delivery.allocatedFot,plan.delivery.allocatedFot,ly.delivery.allocatedFot),
    detailRow("Delivery · OPEX","Результат Delivery","total",fact.delivery.profit,plan.delivery.profit,ly.delivery.profit),
    detailRow("Результат","Прибуток BI","total",fact.profit,plan.profit,ly.profit),
    detailRow("Контроль Excel","Чистий прибуток у вихідному Excel","control",fact.reportedProfit,plan.reportedProfit,ly.reportedProfit,"Контрольний рядок джерела. Не використовується як формула BI.")
  ];
  return {meta:PNL_SOURCE_META,fact,plan,ly,trend,details};
}
export type PnlData=ReturnType<typeof loadPnlData>;
