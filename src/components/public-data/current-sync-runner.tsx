"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, CloudDownload, LoaderCircle, RotateCcw, XCircle } from "lucide-react";

type SeasonOption = {
  id: string;
  label: string;
  matches: number;
  lastUpdatedAt: string | null;
  lastPreparedAt: string | null;
};

type RunResult = {
  seasonId: string;
  ok: boolean;
  batchId?: string;
  providerName?: string;
  matchCount?: number;
  reused?: boolean;
  error?: string;
};

type RowState = "idle" | "running" | "success" | "error";

export function CurrentSyncRunner({
  seasons,
  defaultFrom,
  defaultTo,
}: {
  seasons: SeasonOption[];
  defaultFrom: string;
  defaultTo: string;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [targetCount, setTargetCount] = useState(seasons.length);
  const [states, setStates] = useState<Record<string, RowState>>({});
  const [results, setResults] = useState<RunResult[]>([]);

  async function prepareSeason(seasonId: string): Promise<RunResult> {
    setStates((current) => ({ ...current, [seasonId]: "running" }));

    try {
      const response = await fetch("/api/admin/current-data/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId, from, to }),
      });
      const payload = await response.json() as {
        batchId?: string;
        providerName?: string;
        matchCount?: number;
        reused?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.batchId) {
        throw new Error(payload.error || "Nie udało się przygotować importu.");
      }

      setStates((current) => ({ ...current, [seasonId]: "success" }));
      return {
        seasonId,
        ok: true,
        batchId: payload.batchId,
        providerName: payload.providerName,
        matchCount: payload.matchCount,
        reused: payload.reused,
      };
    } catch (error) {
      setStates((current) => ({ ...current, [seasonId]: "error" }));
      return {
        seasonId,
        ok: false,
        error: error instanceof Error ? error.message : "Nieznany błąd.",
      };
    }
  }

  async function runOne(seasonId: string) {
    if (running) return;
    setRunning(true);
    setCompleted(0);
    setTargetCount(1);
    const result = await prepareSeason(seasonId);
    setResults((current) => [result, ...current.filter((item) => item.seasonId !== seasonId)]);
    setCompleted(1);
    setRunning(false);
  }

  async function runAll() {
    if (running || !seasons.length) return;
    setRunning(true);
    setCompleted(0);
    setTargetCount(seasons.length);
    setResults([]);
    setStates(Object.fromEntries(seasons.map((season) => [season.id, "idle"])) as Record<string, RowState>);

    const nextResults: RunResult[] = [];
    for (const season of seasons) {
      const result = await prepareSeason(season.id);
      nextResults.push(result);
      setResults([...nextResults]);
      setCompleted(nextResults.length);
    }

    setRunning(false);
  }

  const progress = targetCount ? Math.round((completed / targetCount) * 100) : 0;
  const resultBySeason = new Map(results.map((result) => [result.seasonId, result]));

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-xl border border-zinc-200 p-4 sm:grid-cols-[1fr_1fr_auto] dark:border-zinc-800">
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-zinc-500">Data od</span>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            disabled={running}
            className="h-10 rounded-lg border border-zinc-300 bg-white px-3 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-zinc-500">Data do</span>
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            disabled={running}
            className="h-10 rounded-lg border border-zinc-300 bg-white px-3 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <button
          type="button"
          onClick={runAll}
          disabled={running || !from || !to || !seasons.length}
          className="self-end inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? <LoaderCircle size={16} className="mr-2 animate-spin" /> : <CloudDownload size={16} className="mr-2" />}
          Aktualizuj wszystkie ligi
        </button>
      </div>

      {running || completed > 0 ? (
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>{running ? "Przygotowywanie importów" : "Zakończono przygotowywanie"}</span>
            <strong>{completed}/{targetCount}</strong>
          </div>
          <progress className="mt-3 h-2 w-full" max={100} value={progress} />
          <div className="mt-1 text-right text-xs text-zinc-500">{progress}%</div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/60">
              <tr>
                <th className="p-3">Liga i sezon</th>
                <th className="p-3">Mecze w bazie</th>
                <th className="p-3">Ostatnia aktualizacja danych</th>
                <th className="p-3">Ostatnie przygotowanie</th>
                <th className="p-3">Wynik</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {seasons.map((season) => {
                const state = states[season.id] ?? "idle";
                const result = resultBySeason.get(season.id);
                return (
                  <tr key={season.id}>
                    <td className="p-3 font-medium">{season.label}</td>
                    <td className="p-3">{season.matches}</td>
                    <td className="p-3 text-zinc-500">
                      {season.lastUpdatedAt
                        ? new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" }).format(new Date(season.lastUpdatedAt))
                        : "Brak"}
                    </td>
                    <td className="p-3 text-zinc-500">
                      {season.lastPreparedAt
                        ? new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" }).format(new Date(season.lastPreparedAt))
                        : "Nigdy"}
                    </td>
                    <td className="p-3">
                      {state === "running" ? <span className="inline-flex items-center text-blue-600"><LoaderCircle size={15} className="mr-1 animate-spin" />Pobieranie</span> : null}
                      {state === "success" && result?.batchId ? (
                        <Link href={`/imports/${result.batchId}`} className="inline-flex items-center text-emerald-600 hover:underline">
                          {result.reused ? <RotateCcw size={15} className="mr-1" /> : <CheckCircle2 size={15} className="mr-1" />}
                          {result.reused ? "Istniejący raport" : `${result.matchCount ?? 0} meczów`} · {result.providerName}
                        </Link>
                      ) : null}
                      {state === "error" ? <span className="inline-flex items-center text-red-600"><XCircle size={15} className="mr-1" />{result?.error ?? "Błąd"}</span> : null}
                      {state === "idle" ? <span className="text-zinc-400">Oczekuje</span> : null}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => runOne(season.id)}
                        disabled={running || !from || !to}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        Tylko ta liga
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!seasons.length ? <tr><td colSpan={6} className="p-10 text-center text-zinc-500">Brak aktywnych sezonów.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
