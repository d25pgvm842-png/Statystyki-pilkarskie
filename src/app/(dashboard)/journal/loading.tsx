function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800 ${className}`} />;
}

export default function JournalLoading() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-label="Ładowanie Dziennika">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid flex-1 gap-2">
          <Pulse className="h-8 w-56" />
          <Pulse className="h-4 w-full max-w-2xl" />
        </div>
        <div className="flex gap-2">
          <Pulse className="h-10 w-32" />
          <Pulse className="h-10 w-40" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Pulse key={index} className="h-24" />
        ))}
      </div>

      <Pulse className="h-44" />
      <Pulse className="h-80" />
    </div>
  );
}
