"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  Upload,
} from "lucide-react";
import {
  commitCsvImportChunkAction,
  type ImportChunkResult,
} from "@/lib/actions/import-actions";
import { Button } from "@/components/ui/button";

const MAX_AUTOMATIC_RETRIES = 2;

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Nie udało się przetworzyć kolejnej partii importu.";
}

type ProgressState = Pick<
  ImportChunkResult,
  | "remaining"
  | "imported"
  | "duplicates"
  | "invalid"
  | "skipped"
  | "processed"
  | "total"
  | "completed"
  | "status"
>;

export function ImportProgressRunner({
  batchId,
  remaining,
  total,
  initialImported,
  initialDuplicates,
  initialInvalid,
  initialSkipped,
  actionLabel,
  autoRun,
  resume,
}: {
  batchId: string;
  remaining: number;
  total: number;
  initialImported: number;
  initialDuplicates: number;
  initialInvalid: number;
  initialSkipped: number;
  actionLabel: string;
  autoRun: boolean;
  resume: boolean;
}) {
  const router = useRouter();
  const runningRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const mountedRef = useRef(true);
  const autoStartedRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState>(() => ({
    remaining,
    total,
    imported: initialImported,
    duplicates: initialDuplicates,
    invalid: initialInvalid,
    skipped: initialSkipped,
    processed: initialImported + initialDuplicates + initialInvalid + initialSkipped,
    completed: remaining <= 0,
    status: remaining > 0 ? "VALIDATING" : "COMPLETED",
  }));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (runningRef.current) return;
    setProgress({
      remaining,
      total,
      imported: initialImported,
      duplicates: initialDuplicates,
      invalid: initialInvalid,
      skipped: initialSkipped,
      processed: initialImported + initialDuplicates + initialInvalid + initialSkipped,
      completed: remaining <= 0,
      status: remaining > 0 ? "VALIDATING" : "COMPLETED",
    });
  }, [
    remaining,
    total,
    initialImported,
    initialDuplicates,
    initialInvalid,
    initialSkipped,
  ]);

  const finishNavigation = useCallback((result: ProgressState) => {
    if (result.completed) {
      const outcome = result.imported > 0 ? "completed" : "processed";
      router.replace(`/imports/${batchId}?ok=${outcome}`);
      return;
    }
    router.replace(`/imports/${batchId}`);
    router.refresh();
  }, [batchId, router]);

  const runImport = useCallback(async () => {
    if (runningRef.current || progress.remaining <= 0) return;

    runningRef.current = true;
    stopRequestedRef.current = false;
    setRunning(true);
    setStopping(false);
    setRetry(0);
    setError(null);

    let current = progress;
    let retries = 0;
    let failed = false;

    try {
      while (current.remaining > 0 && !stopRequestedRef.current) {
        try {
          const next = await commitCsvImportChunkAction(batchId);
          if (!mountedRef.current) return;
          current = next;
          setProgress(next);
          retries = 0;
          setRetry(0);

          if (next.completed || next.remaining <= 0) break;
          await wait(150);
        } catch (chunkError) {
          if (!mountedRef.current) return;
          if (retries < MAX_AUTOMATIC_RETRIES) {
            retries += 1;
            setRetry(retries);
            await wait(retries * 900);
            continue;
          }
          failed = true;
          setError(errorMessage(chunkError));
          break;
        }
      }
    } finally {
      if (!mountedRef.current) return;
      runningRef.current = false;
      setRunning(false);
      setStopping(false);
      setRetry(0);
      if (!failed) finishNavigation(current);
    }
  }, [batchId, finishNavigation, progress]);

  useEffect(() => {
    if (!autoRun || autoStartedRef.current || remaining <= 0) return;
    autoStartedRef.current = true;
    void runImport();
  }, [autoRun, remaining, runImport]);

  const requestStop = () => {
    stopRequestedRef.current = true;
    setStopping(true);
  };

  const percent = progress.total > 0
    ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
    : 0;

  if (!running && !error && progress.processed === 0) {
    return (
      <Button type="button" onClick={() => void runImport()}>
        <Upload size={16} className="mr-2" />
        {resume ? "Wznów import" : actionLabel} {progress.remaining} poprawnych
      </Button>
    );
  }

  return (
    <div className="min-w-[340px] rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-medium">
            {progress.completed ? (
              <CheckCircle2 size={18} className="text-emerald-600" />
            ) : error ? (
              <AlertTriangle size={18} className="text-red-600" />
            ) : running ? (
              <LoaderCircle size={18} className="animate-spin text-emerald-600" />
            ) : (
              <Pause size={18} className="text-amber-600" />
            )}
            {progress.completed
              ? "Import zakończony"
              : error
                ? "Import został zatrzymany"
                : running
                  ? stopping
                    ? "Kończę bieżącą partię"
                    : retry
                      ? `Ponawiam partię (${retry}/${MAX_AUTOMATIC_RETRIES})`
                      : "Importuję spotkania"
                  : "Import wstrzymany"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Proces działa bez przeładowywania całej strony. Możesz go zatrzymać po bieżącej partii i później wznowić.
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold">{percent}%</div>
          <div className="text-xs text-zinc-500">{progress.processed} z {progress.total}</div>
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
        <div><span className="text-zinc-500">Pozostało</span><div className="font-semibold">{progress.remaining}</div></div>
        <div><span className="text-zinc-500">Zaimportowane</span><div className="font-semibold text-emerald-600">{progress.imported}</div></div>
        <div><span className="text-zinc-500">Duplikaty</span><div className="font-semibold text-amber-600">{progress.duplicates}</div></div>
        <div><span className="text-zinc-500">Błędy</span><div className="font-semibold text-red-600">{progress.invalid}</div></div>
        <div><span className="text-zinc-500">Pominięte</span><div className="font-semibold">{progress.skipped}</div></div>
      </div>

      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error} Zapisane partie pozostają w bazie i można bezpiecznie wznowić proces.
        </div>
      ) : null}

      {!progress.completed ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {running ? (
            <Button type="button" variant="secondary" onClick={requestStop} disabled={stopping}>
              <Pause size={16} className="mr-2" />
              {stopping ? "Zatrzymuję…" : "Zatrzymaj po partii"}
            </Button>
          ) : (
            <Button type="button" onClick={() => void runImport()}>
              {error ? <RefreshCw size={16} className="mr-2" /> : <Play size={16} className="mr-2" />}
              {error ? "Spróbuj ponownie" : "Wznów import"}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
