type RouteLoadingProps = {
  label: string;
  titleWidth?: string;
  metricCount?: number;
  actionCount?: number;
  contentHeight?: string;
};

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800 ${className}`} />;
}

export function RouteLoading({
  label,
  titleWidth = "w-48",
  metricCount = 4,
  actionCount = 0,
  contentHeight = "h-80",
}: RouteLoadingProps) {
  return (
    <div className="grid gap-5" aria-busy="true" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 flex-1 gap-2">
          <Pulse className={`h-8 ${titleWidth}`} />
          <Pulse className="h-4 w-full max-w-2xl" />
        </div>
        {actionCount > 0 ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: actionCount }).map((_, index) => (
              <Pulse key={index} className="h-10 w-32" />
            ))}
          </div>
        ) : null}
      </div>
      <Pulse className="h-20" />
      {metricCount > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: metricCount }).map((_, index) => (
            <Pulse key={index} className="h-24" />
          ))}
        </div>
      ) : null}
      <Pulse className={contentHeight} />
    </div>
  );
}
