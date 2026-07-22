import { RouteLoading } from "@/components/layout/route-loading";

export default function DataQualityLoading() {
  return (
    <RouteLoading
      label="Ładowanie kontroli danych"
      titleWidth="w-36"
      metricCount={4}
      actionCount={0}
      contentHeight="h-[28rem]"
    />
  );
}
