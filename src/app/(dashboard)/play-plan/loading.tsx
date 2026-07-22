import { RouteLoading } from "@/components/layout/route-loading";

export default function PlayPlanLoading() {
  return (
    <RouteLoading
      label="Ładowanie planu gry"
      titleWidth="w-44"
      metricCount={3}
      actionCount={1}
      contentHeight="h-80"
    />
  );
}
