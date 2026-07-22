import { RouteLoading } from "@/components/layout/route-loading";

export default function JournalLoading() {
  return (
    <RouteLoading
      label="Ładowanie Dziennika"
      titleWidth="w-56"
      metricCount={6}
      actionCount={2}
      contentHeight="h-96"
    />
  );
}
