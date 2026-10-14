import { DigitalReportShell } from "@/components/DigitalReportShell";
import { DIGITAL_REPORTS } from "@/lib/digital-reports";

export default function Page(){
  const report=DIGITAL_REPORTS.find(item=>item.slug==="channels")!;
  return <DigitalReportShell report={report}/>;
}
