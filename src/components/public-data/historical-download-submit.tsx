"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Database, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function HistoricalDownloadProgress() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/25"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-emerald-800 dark:text-emerald-200">
          Trwa pobieranie sezonu i tworzenie raportu weryfikacyjnego
        </div>
        <div className="shrink-0 font-mono text-xs text-emerald-700 dark:text-emerald-300">
          {elapsedSeconds} s
        </div>
      </div>
      <progress
        className="mt-3 h-2 w-full overflow-hidden rounded-full accent-emerald-600"
        aria-label="Pobieranie historycznych danych sezonu"
      />
      <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
        Operacja pracuje na serwerze. Nie klikaj ponownie i nie zamykaj tej karty. Po zakończeniu automatycznie otworzy się raport importu.
      </div>
    </div>
  );
}

export function HistoricalDownloadSubmit() {
  const { pending } = useFormStatus();

  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <Button type="submit" disabled={pending} aria-disabled={pending}>
          {pending ? (
            <LoaderCircle size={16} className="mr-2 animate-spin" />
          ) : (
            <Database size={16} className="mr-2" />
          )}
          {pending ? "Pobieranie i przygotowanie danych" : "Pobierz cały sezon"}
        </Button>
      </div>

      {pending ? <HistoricalDownloadProgress /> : null}
    </div>
  );
}
