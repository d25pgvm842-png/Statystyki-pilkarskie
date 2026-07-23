"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error", error);
  }, [error]);

  return (
    <html lang="pl">
      <body className="bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
        <main className="flex min-h-screen items-center justify-center p-4">
          <section className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-950 dark:bg-zinc-900">
            <p className="text-sm font-medium text-red-600 dark:text-red-300">
              Błąd aplikacji
            </p>
            <h1 className="mt-2 text-2xl font-semibold">
              Nie udało się uruchomić widoku
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Dane nie zostały celowo zmienione. Spróbuj ponownie. Gdy problem
              pozostanie, odśwież całą aplikację.
            </p>

            {error.digest ? (
              <p className="mt-3 break-all text-xs text-zinc-500">
                Kod błędu: {error.digest}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Spróbuj ponownie
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Odśwież aplikację
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
