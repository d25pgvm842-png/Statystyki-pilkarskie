function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-label="Ładowanie widoku">
      <div className="grid gap-2">
        <Pulse className="h-8 w-48" />
        <Pulse className="h-4 w-full max-w-xl" />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Pulse className="h-24" />
        <Pulse className="h-24" />
        <Pulse className="h-24" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Pulse className="h-28" />
        <Pulse className="h-28" />
        <Pulse className="h-28" />
        <Pulse className="h-28" />
      </div>

      <Pulse className="h-72" />
    </div>
  );
}
