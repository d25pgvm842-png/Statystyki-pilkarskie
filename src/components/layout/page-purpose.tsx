import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";

export function PagePurpose({
  children,
  nextHref,
  nextLabel,
}: {
  children: React.ReactNode;
  nextHref?: string;
  nextLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-100">
      <div className="flex min-w-0 items-start gap-3">
        <Info size={18} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-300" />
        <div>{children}</div>
      </div>
      {nextHref && nextLabel ? (
        <Link href={nextHref} className="inline-flex shrink-0 items-center font-medium text-blue-700 hover:underline dark:text-blue-300">
          {nextLabel}<ArrowRight size={14} className="ml-1" />
        </Link>
      ) : null}
    </div>
  );
}
