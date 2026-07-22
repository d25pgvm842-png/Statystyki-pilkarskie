import { RouteLoading } from "@/components/layout/route-loading";

export default function AnalysisLoading() {
  return (
    <RouteLoading
      label="Ładowanie analizy meczu"
      titleWidth="w-56"
      metricCount={4}
      actionCount={1}
      contentHeight="h-[30rem]"
    />
  );
}
