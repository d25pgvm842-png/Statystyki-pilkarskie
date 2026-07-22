import { RouteLoading } from "@/components/layout/route-loading";

export default function RecommendationsLoading() {
  return (
    <RouteLoading
      label="Ładowanie centrum dnia"
      titleWidth="w-48"
      metricCount={4}
      actionCount={0}
      contentHeight="h-[30rem]"
    />
  );
}
