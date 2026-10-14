import {
  PNL_SOURCE,
  PNL_SOURCE_META,
  type PnlSeriesKey
} from "@/lib/data/pnl-source";

export const PNL_MONTHS = ["Січ","Лют","Бер","Кві","Тра","Чер","Лип","Сер"] as const;
export const PNL_MONTHS_LONG = [
  "Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень"
] as const;

type Getter = (code: string) => number;

export type PnlCalculated = {
  revenue:number;
  cogs:number;
  markup:number;
  markupRate:number;
  operatingExpenses:number;
  opexRate:number;
  profit:number;
  profitRate:number;
  reportedProfit:number;
  reportedGap:number;
  expenseGroups:{
    fot:number;
    marketing:number;
    digitalServices:number;
    deliveryOperations:number;
    aggregatorCosts:number;
  };
  delivery:{
    revenue:number;cogs:number;markup:number;markupRate:number;
    marketingFot:number;media:number;agency:number;affiliate:number;marketingTotal:number;marketingNonFot:number;
    serviceOps:number;itDigital:number;digitalServices:number;logistics:number;acquiring:number;couriers:number;
    allocatedFot:number;fot:number;opex:number;profit:number;profitRate:number;
  };
  aggregators:{
    revenue:number;cogs:number;markup:number;markupRate:number;
    commission:number;commissionRate:number;promo:number;promoRate:number;commissionPromoRate:number;
    getOrder:number;allocatedFot:number;fot:number;opex:number;profit:number;profitRate:number;
  };
};

export type PnlDetailRow = {
  section:string;
  label:string;
  kind:"income"|"expense"|"total";
  fact:number;
  plan:number;
  ly:number;
};

function safe(value:number|null|undefined){
  return Number.isFinite(Number(value)) ? Number(value ?? 0) : 0;
}

function sourceValue(code:string,key:PnlSeriesKey,monthIndex:number){
  return safe(PNL_SOURCE[code]?.[key]?.[monthIndex]);
}

function sourceRange(code:string,key:PnlSeriesKey,startMonth:number,endMonth:number){
  const series=PNL_SOURCE[code]?.[key]??[];
  return series.slice(startMonth,endMonth+1).reduce<number>((sum,value)=>sum+safe(value),0);
}

function calculate(get:Getter):PnlCalculated{
  const revenue=get("revenue_total");
  const deliveryRevenue=get("revenue_delivery");
  const deliveryCogs=get("cogs_delivery");
  const aggregatorRevenue=get("revenue_aggregators");
  const aggregatorCogs=get("cogs_aggregators");

  // Merchandise COGS is channel COGS only. Aggregator commission is an operating cost.
  const cogs=deliveryCogs+aggregatorCogs;

  const marketingFot=get("marketing_fot");
  const media=get("facebook")+get("google");
  const agency=get("agency");
  const affiliate=get("admitad");
  const marketingNonFot=media+agency+affiliate;
  const marketingTotal=marketingFot+marketingNonFot;

  const serviceOps=get("email_esputnik")+get("turbo_sms_ai")+get("binotel");
  const itDigital=get("site_support")+get("webvizion")+get("dots");
  const digitalServices=serviceOps+itDigital;

  const logistics=get("uklon")+get("glovo_ondemand")+get("fuel")+get("taxi");
  const acquiring=get("easypay");
  const couriers=get("couriers_freelance");
  const deliveryOperations=logistics+acquiring+couriers;

  const management=get("salary_kostiushko");
  const deliveryManager=get("salary_nedogibchenko");
  const contactCenter=get("contact_center");
  const sharedFot=management+contactCenter;
  const deliveryAllocatedFot=sharedFot*0.7;
  const aggregatorAllocatedFot=sharedFot*0.3;
  const deliveryFot=marketingFot+deliveryManager+deliveryAllocatedFot;
  const aggregatorFot=aggregatorAllocatedFot;
  const totalFot=deliveryFot+aggregatorFot;

  const commission=get("commission_total");
  const promo=get("aggregator_promo");
  const getOrder=get("getorder");
  const aggregatorCosts=commission+promo+getOrder;

  const deliveryMarkup=deliveryRevenue-deliveryCogs;
  const aggregatorMarkup=aggregatorRevenue-aggregatorCogs;

  const deliveryOpex=deliveryFot+marketingNonFot+digitalServices+deliveryOperations;
  const aggregatorOpex=aggregatorFot+aggregatorCosts;
  const operatingExpenses=deliveryOpex+aggregatorOpex;

  const deliveryProfit=deliveryMarkup-deliveryOpex;
  const aggregatorProfit=aggregatorMarkup-aggregatorOpex;
  const markup=deliveryMarkup+aggregatorMarkup;
  const profit=deliveryProfit+aggregatorProfit;
  const reportedProfit=get("reported_profit");

  return {
    revenue,
    cogs,
    markup,
    markupRate:revenue?markup/revenue:0,
    operatingExpenses,
    opexRate:revenue?operatingExpenses/revenue:0,
    profit,
    profitRate:revenue?profit/revenue:0,
    reportedProfit,
    reportedGap:profit-reportedProfit,
    expenseGroups:{
      fot:totalFot,
      marketing:marketingNonFot,
      digitalServices,
      deliveryOperations,
      aggregatorCosts
    },
    delivery:{
      revenue:deliveryRevenue,
      cogs:deliveryCogs,
      markup:deliveryMarkup,
      markupRate:deliveryRevenue?deliveryMarkup/deliveryRevenue:0,
      marketingFot,
      media,
      agency,
      affiliate,
      marketingTotal,
      marketingNonFot,
      serviceOps,
      itDigital,
      digitalServices,
      logistics,
      acquiring,
      couriers,
      allocatedFot:deliveryAllocatedFot,
      fot:deliveryFot,
      opex:deliveryOpex,
      profit:deliveryProfit,
      profitRate:deliveryRevenue?deliveryProfit/deliveryRevenue:0
    },
    aggregators:{
      revenue:aggregatorRevenue,
      cogs:aggregatorCogs,
      markup:aggregatorMarkup,
      markupRate:aggregatorRevenue?aggregatorMarkup/aggregatorRevenue:0,
      commission,
      commissionRate:aggregatorRevenue?commission/aggregatorRevenue:0,
      promo,
      promoRate:aggregatorRevenue?promo/aggregatorRevenue:0,
      commissionPromoRate:aggregatorRevenue?(commission+promo)/aggregatorRevenue:0,
      getOrder,
      allocatedFot:aggregatorAllocatedFot,
      fot:aggregatorFot,
      opex:aggregatorOpex,
      profit:aggregatorProfit,
      profitRate:aggregatorRevenue?aggregatorProfit/aggregatorRevenue:0
    }
  };
}

function period(key:PnlSeriesKey,startMonth:number,endMonth:number){
  return calculate(code=>sourceRange(code,key,startMonth,endMonth));
}

function month(key:PnlSeriesKey,index:number){
  return calculate(code=>sourceValue(code,key,index));
}

function detailRow(
  section:string,
  label:string,
  kind:PnlDetailRow["kind"],
  fact:number,
  plan:number,
  ly:number
):PnlDetailRow{
  return {section,label,kind,fact,plan,ly};
}

export function loadPnlData({
  startMonth=0,
  endMonth=PNL_SOURCE_META.latestFactMonth-1
}: {
  startMonth?:number;
  endMonth?:number;
} = {}){
  const lastMonth=PNL_SOURCE_META.latestFactMonth-1;
  const start=Math.max(0,Math.min(startMonth,lastMonth));
  const end=Math.max(start,Math.min(endMonth,lastMonth));

  const fact=period("fact2026",start,end);
  const plan=period("plan2026",start,end);
  const ly=period("fact2025",start,end);

  const trend=PNL_MONTHS.slice(start,end+1).map((label,offset)=>{
    const index=start+offset;
    const current=month("fact2026",index);
    const planned=month("plan2026",index);
    const previous=month("fact2025",index);
    return {
      label,
      revenueFact:current.revenue,
      revenuePlan:planned.revenue,
      revenueLy:previous.revenue,
      profitFact:current.profit,
      profitPlan:planned.profit,
      profitLy:previous.profit,
      markupFact:current.markup,
      markupPlan:planned.markup,
      markupLy:previous.markup,
      markupRateFact:current.markupRate,
      markupRatePlan:planned.markupRate,
      markupRateLy:previous.markupRate,
      profitRateFact:current.profitRate,
      profitRatePlan:planned.profitRate,
      profitRateLy:previous.profitRate
    };
  });

  const details:PnlDetailRow[]=[
    detailRow("Виручка","Виручка всього","income",fact.revenue,plan.revenue,ly.revenue),
    detailRow("Виручка","Доставка","income",fact.delivery.revenue,plan.delivery.revenue,ly.delivery.revenue),
    detailRow("Виручка","Агрегатори","income",fact.aggregators.revenue,plan.aggregators.revenue,ly.aggregators.revenue),

    detailRow("Валовий прибуток","Собівартість товару","expense",fact.cogs,plan.cogs,ly.cogs),
    detailRow("Валовий прибуток","Валовий прибуток","total",fact.markup,plan.markup,ly.markup),

    detailRow("ФОТ","ФОТ команди","expense",fact.expenseGroups.fot,plan.expenseGroups.fot,ly.expenseGroups.fot),

    detailRow("Маркетинг","Paid Media · Facebook + Google","expense",fact.delivery.media,plan.delivery.media,ly.delivery.media),
    detailRow("Маркетинг","Агенція та affiliate","expense",fact.delivery.agency+fact.delivery.affiliate,plan.delivery.agency+plan.delivery.affiliate,ly.delivery.agency+ly.delivery.affiliate),
    detailRow("Маркетинг","Маркетинг без ФОТ","total",fact.expenseGroups.marketing,plan.expenseGroups.marketing,ly.expenseGroups.marketing),

    detailRow("IT / Services","CRM / комунікації","expense",fact.delivery.serviceOps,plan.delivery.serviceOps,ly.delivery.serviceOps),
    detailRow("IT / Services","IT / Digital","expense",fact.delivery.itDigital,plan.delivery.itDigital,ly.delivery.itDigital),
    detailRow("IT / Services","IT + Services","total",fact.expenseGroups.digitalServices,plan.expenseGroups.digitalServices,ly.expenseGroups.digitalServices),

    detailRow("Логістика та доставка","Логістика","expense",fact.delivery.logistics,plan.delivery.logistics,ly.delivery.logistics),
    detailRow("Логістика та доставка","EasyPay","expense",fact.delivery.acquiring,plan.delivery.acquiring,ly.delivery.acquiring),
    detailRow("Логістика та доставка","Кур'єри + фріланс","expense",fact.delivery.couriers,plan.delivery.couriers,ly.delivery.couriers),
    detailRow("Логістика та доставка","Delivery Operations","total",fact.expenseGroups.deliveryOperations,plan.expenseGroups.deliveryOperations,ly.expenseGroups.deliveryOperations),

    detailRow("Агрегатори","Комісія агрегаторів","expense",fact.aggregators.commission,plan.aggregators.commission,ly.aggregators.commission),
    detailRow("Агрегатори","Просування","expense",fact.aggregators.promo,plan.aggregators.promo,ly.aggregators.promo),
    detailRow("Агрегатори","GetOrder","expense",fact.aggregators.getOrder,plan.aggregators.getOrder,ly.aggregators.getOrder),
    detailRow("Агрегатори","Витрати Aggregators","total",fact.expenseGroups.aggregatorCosts,plan.expenseGroups.aggregatorCosts,ly.expenseGroups.aggregatorCosts),

    detailRow("Результат","OPEX","expense",fact.operatingExpenses,plan.operatingExpenses,ly.operatingExpenses),
    detailRow("Результат","EBITDA · управлінська","total",fact.profit,plan.profit,ly.profit)
  ];

  return {
    meta:{
      ...PNL_SOURCE_META,
      startMonth:start,
      endMonth:end,
      periodLabel:start===end
        ? `${PNL_MONTHS_LONG[start]} 2026`
        : `${PNL_MONTHS_LONG[start]}–${PNL_MONTHS_LONG[end]} 2026`
    },
    fact,
    plan,
    ly,
    trend,
    details
  };
}

export type PnlData=ReturnType<typeof loadPnlData>;
