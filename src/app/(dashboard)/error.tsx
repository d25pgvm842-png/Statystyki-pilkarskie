"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-2xl items-center justify-center px-4">
      <div className="w-full rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-950 dark:bg-zinc-900">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-red-50 p-3 text-red-600 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">Nie udało się otworzyć tego widoku</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Dane nie zostały zmienione. Spróbuj ponownie albo wróć do ekranu „Dziś”.
            </p>

            {error.digest ? (
              <p className="mt-3 text-xs text-zinc-500">Kod błędu: {error.digest}</p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <RefreshCw size={16} className="mr-2" />
                Spróbuj ponownie
              </button>
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <Home size={16} className="mr-2" />
                Wróć na Dziś
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
