import type { PeriodQuality, SnapshotMetadata } from "@/lib/digital-quality";

/** Dates and limitations travel with the displayed source, independently of fetch time. */
export function DigitalQualityNotice({ quality, dates, snapshot, sources }: {
  quality: PeriodQuality; dates: string; snapshot?: SnapshotMetadata; sources?: Record<string, PeriodQuality>;
}) {
  return <div className="lfl-banner">
    {dates}. Повнота: {quality.coverage}; ліміт джерела: {quality.providerRowLimit ?? "UNKNOWN"}.
    {quality.observedDates !== null && <> Отримано дат: {quality.observedDates} із {quality.expectedDates ?? "UNKNOWN"}.</>}
    {quality.zeroProvenance === "UNKNOWN" && <> Старий контракт міг підставляти нулі замість пропусків; їх походження не підтверджене.</>}
    {sources && Object.entries(sources).map(([name, source]) => <span key={name}> {name}: {source.from ?? "UNKNOWN"} — {source.to ?? "UNKNOWN"}; {source.coverage}, дат {source.observedDates ?? "UNKNOWN"}/{source.expectedDates ?? "UNKNOWN"}.</span>)}
    {snapshot && <> Знімок: {snapshot.from ?? "UNKNOWN"} — {snapshot.to ?? "UNKNOWN"}, {snapshot.returnedRows} рядків; ліміт звіту {snapshot.rpcRowLimit}. Ідентичність збору не підтверджена.</>}
    <> Джерела читаються окремо; узгодженість одного знімка не підтверджена.</>
  </div>;
}
