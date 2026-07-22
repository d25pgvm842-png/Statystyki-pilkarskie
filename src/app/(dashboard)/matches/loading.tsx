function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800 ${className}`} />;
}

export default function MatchesLoading() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-label="Ładowanie meczów">
      <div className="flex items-center justify-between gap-3">
        <div className="grid flex-1 gap-2">
          <Pulse className="h-8 w-40" />
          <Pulse className="h-4 w-full max-w-xl" />
        </div>
        <Pulse className="h-10 w-32" />
      </div>

      <Pulse className="h-24" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Pulse className="h-24" />
        <Pulse className="h-24" />
        <Pulse className="h-24" />
        <Pulse className="h-24" />
      </div>

      <Pulse className="h-96" />
    </div>
  );
}
