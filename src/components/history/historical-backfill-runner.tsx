"use client";

import { useMemo, useRef, useState } from "react";
import {
  historicalRequestDelay,
  type HistoricalDetailMode,
} from "@/lib/history/backfill-policy";
import {
  CheckCircle2,
  CirclePause,
  CloudDownload,
  LoaderCircle,
  Play,
  RefreshCcw,
} from "lucide-react";

type LeagueOption = {
  id: string;
  name: string;
  code: string;
};

type Coverage = {
  corners: number;
  cards: number;
  shots: number;
  fouls: number;
  offsides: number;
};

type Job = {
  id: string;
  leagueId: string;
  leagueName: string;
  leagueCode: string;
  seasonId: string;
  seasonName: string;
  providerSeason: number;
  status: "READY" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED";
  fixturesTotal: number;
  fixturesProcessed: number;
  detailMode: HistoricalDetailMode;
  requestsUsed: number;
  importedRows: number;
  duplicateRows: number;
  invalidRows: number;
  lastError: string | null;
  coverage: Coverage;
  reused?: boolean;
};

const DEFAULT_SEASONS = [2023, 2024, 2025];

function progress(job: Job) {
  if (!job.fixturesTotal) return 0;
  return Math.min(
    100,
    Math.round((job.fixturesProcessed / job.fixturesTotal) * 100),
  );
}

function statusLabel(status: Job["status"]) {
  if (status === "COMPLETED") return "Zakończone";
  if (status === "PAUSED") return "Wstrzymane";
  if (status === "FAILED") return "Błąd";
  if (status === "RUNNING") return "W toku";
  return "Gotowe";
}

export function HistoricalBackfillRunner({
  leagues,
  initialJobs,
}: {
  leagues: LeagueOption[];
  initialJobs: Job[];
}) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [selectedLeagues, setSelectedLeagues] = useState(
    () => new Set(leagues.map((league) => league.id)),
  );
  const [selectedSeasons, setSelectedSeasons] = useState(
    () => new Set(DEFAULT_SEASONS),
  );
  const [planning, setPlanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [sessionBudget, setSessionBudget] = useState(80);
  const [sessionRequests, setSessionRequests] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const stopRequested = useRef(false);
  const sessionRequestsRef = useRef(0);

  const sortedJobs = useMemo(
    () => [...jobs].sort((left, right) =>
      left.leagueName.localeCompare(right.leagueName, "pl")
      || right.providerSeason - left.providerSeason
    ),
    [jobs],
  );

  function replaceJob(next: Job) {
    setJobs((current) => [
      next,
      ...current.filter((job) => job.id !== next.id),
    ]);
  }

  function addSessionRequests(value: number) {
    if (value <= 0) return;
    sessionRequestsRef.current += value;
    setSessionRequests(sessionRequestsRef.current);
  }

  function toggleLeague(id: string) {
    setSelectedLeagues((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSeason(year: number) {
    setSelectedSeasons((current) => {
      const next = new Set(current);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  async function planSelected() {
    if (planning || running) return;
    setPlanning(true);
    setMessage(null);
    let planned = 0;
    let failed = 0;

    for (const leagueId of selectedLeagues) {
      for (const providerSeason of selectedSeasons) {
        try {
          const response = await fetch(
            "/api/admin/historical-data/plan",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ leagueId, providerSeason }),
            },
          );
          const payload = await response.json() as Job & { error?: string };
          if (!response.ok || !payload.id) {
            throw new Error(
              payload.error || "Nie udało się utworzyć zadania.",
            );
          }
          replaceJob(payload);
          planned += 1;
          addSessionRequests(payload.reused ? 0 : 1);
        } catch {
          failed += 1;
        }
      }
    }

    setPlanning(false);
    setMessage(
      `Zaplanowano lub odnaleziono ${planned} zadań. Błędy: ${failed}.`,
    );
  }

  async function stepJob(job: Job) {
    const previousRequests = job.requestsUsed;
    const response = await fetch(
      "/api/admin/historical-data/step",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      },
    );
    const payload = await response.json() as Job & { error?: string };
    if (!response.ok || !payload.id) {
      throw new Error(payload.error || "Nie udało się wykonać kroku.");
    }

    replaceJob(payload);
    const delta = Math.max(0, payload.requestsUsed - previousRequests);
    addSessionRequests(delta);
    return { job: payload, apiRequests: delta };
  }

  async function runJob(start: Job) {
    let current = start;
    while (
      !stopRequested.current
      && current.status !== "COMPLETED"
    ) {
      if (sessionRequestsRef.current >= sessionBudget) {
        setMessage(
          "Osiągnięto budżet wywołań tej sesji. Postęp zapisano — uruchom ponownie później.",
        );
        break;
      }

      const result = await stepJob(current);
      current = result.job;
      if (current.status === "PAUSED" || current.status === "FAILED") break;
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          historicalRequestDelay(current.detailMode, result.apiRequests),
        )
      );
    }
  }

  async function runOne(job: Job) {
    if (running || planning || job.status === "COMPLETED") return;
    stopRequested.current = false;
    setRunning(true);
    setMessage(null);
    try {
      await runJob(job);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Nieznany błąd backfillu.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function runAll() {
    if (running || planning) return;
    stopRequested.current = false;
    setRunning(true);
    setMessage(null);

    try {
      const candidates = sortedJobs.filter(
        (job) => job.status !== "COMPLETED",
      );
      for (const candidate of candidates) {
        if (stopRequested.current || sessionRequestsRef.current >= sessionBudget) break;
        const current = jobs.find((job) => job.id === candidate.id) ?? candidate;
        await runJob(current);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Nieznany błąd backfillu.",
      );
    } finally {
      setRunning(false);
    }
  }

  function stop() {
    stopRequested.current = true;
    setMessage("Zatrzymywanie po zakończeniu bieżącego bezpiecznego kroku.");
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="text-sm font-medium">Ligi do zaplanowania</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {leagues.map((league) => (
                <label key={league.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedLeagues.has(league.id)}
                    onChange={() => toggleLeague(league.id)}
                    disabled={planning || running}
                  />
                  {league.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium">Sezony API-Football</div>
            <div className="mt-2 flex flex-wrap gap-4">
              {DEFAULT_SEASONS.map((year) => (
                <label key={year} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedSeasons.has(year)}
                    onChange={() => toggleSeason(year)}
                    disabled={planning || running}
                  />
                  {year}/{String(year + 1).slice(-2)}
                </label>
              ))}
            </div>

            <label className="mt-4 grid max-w-xs gap-1 text-sm">
              <span className="text-xs text-zinc-500">
                Budżet zapytań API w tej sesji
              </span>
              <input
                type="number"
                min={1}
                max={5000}
                value={sessionBudget}
                onChange={(event) =>
                  setSessionBudget(Math.max(1, Number(event.target.value) || 1))
                }
                disabled={running}
                className="h-10 rounded-lg border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={planSelected}
            disabled={
              planning
              || running
              || !selectedLeagues.size
              || !selectedSeasons.size
            }
            className="inline-flex h-10 items-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {planning
              ? <LoaderCircle size={16} className="mr-2 animate-spin" />
              : <CloudDownload size={16} className="mr-2" />}
            Zaplanuj wybrane
          </button>
          <button
            type="button"
            onClick={runAll}
            disabled={running || planning || !jobs.length}
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {running
              ? <LoaderCircle size={16} className="mr-2 animate-spin" />
              : <Play size={16} className="mr-2" />}
            Uruchom wszystkie gotowe
          </button>
          {running ? (
            <button
              type="button"
              onClick={stop}
              className="inline-flex h-10 items-center rounded-lg border border-amber-300 px-4 text-sm font-medium text-amber-700"
            >
              <CirclePause size={16} className="mr-2" />
              Zatrzymaj bezpiecznie
            </button>
          ) : null}
          <div className="ml-auto text-sm text-zinc-500">
            Sesja: {sessionRequests}/{sessionBudget} wywołań
          </div>
        </div>

        {message ? (
          <div className="rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
            {message}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/60">
              <tr>
                <th className="p-3">Liga i sezon</th>
                <th className="p-3">Status</th>
                <th className="p-3">Postęp</th>
                <th className="p-3">Zapis</th>
                <th className="p-3">Rożne</th>
                <th className="p-3">Kartki</th>
                <th className="p-3">Strzały</th>
                <th className="p-3">Faule</th>
                <th className="p-3">Spalone</th>
                <th className="p-3">API</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sortedJobs.map((job) => (
                <tr key={job.id}>
                  <td className="p-3">
                    <div className="font-medium">{job.leagueName}</div>
                    <div className="text-xs text-zinc-500">{job.seasonName}</div>
                  </td>
                  <td className="p-3">
                    <span className={
                      job.status === "COMPLETED"
                        ? "text-emerald-600"
                        : job.status === "FAILED"
                          ? "text-red-600"
                          : job.status === "PAUSED"
                            ? "text-amber-600"
                            : "text-blue-600"
                    }>
                      {statusLabel(job.status)}
                    </span>
                    {job.lastError ? (
                      <div className="mt-1 max-w-xs text-xs text-red-600">
                        {job.lastError}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">
                      {job.fixturesProcessed}/{job.fixturesTotal}
                    </div>
                    <progress
                      className="mt-1 h-2 w-36"
                      max={100}
                      value={progress(job)}
                    />
                    <div className="text-xs text-zinc-500">{progress(job)}%</div>
                  </td>
                  <td className="p-3">
                    <div>{job.importedRows} zaimportowanych</div>
                    <div className="text-xs text-zinc-500">
                      {job.duplicateRows} duplikatów · {job.invalidRows} błędnych
                    </div>
                  </td>
                  <td className="p-3">{job.coverage.corners}%</td>
                  <td className="p-3">{job.coverage.cards}%</td>
                  <td className="p-3">{job.coverage.shots}%</td>
                  <td className="p-3">{job.coverage.fouls}%</td>
                  <td className="p-3">{job.coverage.offsides}%</td>
                  <td className="p-3">
                    <div>{job.requestsUsed}</div>
                    <div className="text-xs text-zinc-500">
                      {job.detailMode === "SINGLE_ID"
                        ? "Free · 1 mecz"
                        : "Pakiet · do 20"}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => runOne(job)}
                      disabled={
                        running
                        || planning
                        || job.status === "COMPLETED"
                      }
                      className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      {job.status === "PAUSED" || job.status === "FAILED"
                        ? <RefreshCcw size={14} className="mr-1" />
                        : job.status === "COMPLETED"
                          ? <CheckCircle2 size={14} className="mr-1" />
                          : <Play size={14} className="mr-1" />}
                      {job.status === "COMPLETED" ? "Gotowe" : "Uruchom / wznów"}
                    </button>
                  </td>
                </tr>
              ))}
              {!sortedJobs.length ? (
                <tr>
                  <td colSpan={11} className="p-10 text-center text-zinc-500">
                    Nie zaplanowano jeszcze historycznych sezonów.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
          Zamknięcie karty nie usuwa postępu. Zadanie można później wznowić.
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Plan Free może nie udostępniać wszystkich starszych sezonów.
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          Ręczne korekty i konflikty źródeł są chronione przez istniejący importer.
        </div>
      </div>
    </div>
  );
}
