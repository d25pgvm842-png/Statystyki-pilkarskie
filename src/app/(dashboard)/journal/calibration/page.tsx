import Form from "next/form";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Calculator,
  Download,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requireUser } from "@/lib/auth";
import { loadAnalysisJournal } from "@/lib/data/analysis-journal";
import { prisma } from "@/lib/db";
import type { CalibrationSegmentRow } from "@/lib/stats/journal-calibration";
import { TREND_STAT_DEFINITIONS } from "@/lib/stats/trends";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  WATCHING: "Obserwowane",
  PLAYED: "Zagrane otwarte",
  REJECTED: "Odrzucone",
  SETTLED: "Rozliczone",
  VOID: "Void",
};

const sourceLabels: Record<string, string> = {
  SCANNER: "Skaner",
  MANUAL: "Ręczne",
};

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function dateTextParam(value: string | string[] | undefined) {
  const text = stringParam(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? "" : text;
}

function utcDate(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function nextUtcDay(value: string) {
  const date = utcDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${formatNumber(value, 1)}%`;
}

function signedPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value > 0 ? "+" : ""}${formatNumber(value, 1)} pp`;
}

function brier(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : formatNumber(value, 3);
}

function currency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(value);
}

function gapClass(value: number | null) {
  if (value === null) return "text-zinc-500";
  if (Math.abs(value) < 3) return "text-emerald-600";
  return value > 0 ? "text-blue-600" : "text-amber-600";
}

function CalibrationTable({
  title,
  rows,
  description,
}: {
  title: string;
  rows: CalibrationSegmentRow[];
  description?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-emerald-600" />
          <CardTitle>{title}</CardTitle>
        </div>
        {description ? <p className="text-sm text-zinc-500">{description}</p> : null}
      </CardHeader>
      <CardContent className="p-0">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1260px] text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                <tr>
                  <th className="p-3">Segment</th>
                  <th className="p-3">Snapshoty</th>
                  <th className="p-3">Rozliczone W/L</th>
                  <th className="p-3">Śr. modelu</th>
                  <th className="p-3">Trafność</th>
                  <th className="p-3">Luka</th>
                  <th className="p-3">Brier</th>
                  <th className="p-3">Śr. EV</th>
                  <th className="p-3">Obrót</th>
                  <th className="p-3">Profit</th>
                  <th className="p-3">ROI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="p-3 font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{row.label}</span>
                        {row.smallSample ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <AlertTriangle size={11} className="mr-1" />mała próba
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3">{row.snapshotEntries}</td>
                    <td className="p-3">{row.resolvedEntries} · {row.wins}T/{row.losses}N</td>
                    <td className="p-3">{percent(row.averageModelProbability)}</td>
                    <td className="p-3 font-medium">{percent(row.actualHitRate)}</td>
                    <td className={`p-3 font-medium ${gapClass(row.calibrationGap)}`}>{signedPercent(row.calibrationGap)}</td>
                    <td className="p-3 font-medium">{brier(row.brierScore)}</td>
                    <td className="p-3">{percent(row.averageExpectedValue)}</td>
                    <td className="p-3">{row.financialEntries ? currency(row.turnover) : "—"}</td>
                    <td className={`p-3 font-medium ${row.financialEntries ? (row.profit >= 0 ? "text-emerald-600" : "text-red-600") : "text-zinc-500"}`}>
                      {row.financialEntries ? currency(row.profit) : "—"}
                    </td>
                    <td className="p-3 font-medium">{row.financialEntries ? percent(row.roi) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-zinc-500">Brak snapshotów modelu dla wybranych filtrów.</div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function JournalCalibrationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const statusParam = stringParam(params.status);
  const status = ["WATCHING", "PLAYED", "REJECTED", "SETTLED", "VOID"].includes(statusParam)
    ? statusParam
    : null;
  const statParam = stringParam(params.statKey);
  const statKey = TREND_STAT_DEFINITIONS.some((item) => item.key === statParam)
    ? statParam
    : null;
  const seasonId = stringParam(params.seasonId) || null;
  const leagueId = stringParam(params.leagueId) || null;
  const sourceParam = stringParam(params.source);
  const source = ["SCANNER", "MANUAL"].includes(sourceParam) ? sourceParam : null;
  const fromText = dateTextParam(params.from);
  const toText = dateTextParam(params.to);

  const [journal, seasons, leagues] = await Promise.all([
    loadAnalysisJournal({
      userId: user.id,
      seasonId,
      leagueId,
      status,
      statKey,
      source,
      from: utcDate(fromText),
      to: nextUtcDay(toText),
    }),
    prisma.season.findMany({
      where: { league: { active: true } },
      include: { league: true },
      orderBy: [{ startsAt: "desc" }, { league: { name: "asc" } }],
    }),
    prisma.league.findMany({ orderBy: { name: "asc" } }),
  ]);

  const query = new URLSearchParams();
  if (seasonId) query.set("seasonId", seasonId);
  if (leagueId) query.set("leagueId", leagueId);
  if (status) query.set("status", status);
  if (statKey) query.set("statKey", statKey);
  if (source) query.set("source", source);
  if (fromText) query.set("from", fromText);
  if (toText) query.set("to", toText);
  const querySuffix = query.size ? `?${query.toString()}` : "";
  const { summary } = journal.calibration;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/journal${querySuffix}`} className="mb-3 inline-flex items-center text-sm font-medium text-emerald-600 hover:underline">
            <ArrowLeft size={15} className="mr-1" />Wróć do Dziennika
          </Link>
          <div className="flex items-center gap-2">
            <TrendingUp className="text-emerald-600" size={24} />
            <h1 className="text-2xl font-semibold">Kalibracja modelu i jakości EV</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Czy zapisane prawdopodobieństwa i przewagi odpowiadają rzeczywistym wynikom.
          </p>
        </div>
        <Link
          href={`/journal/calibration/export${querySuffix}`}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          <Download size={16} className="mr-2" />Eksport kalibracji
        </Link>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
        Brier Score ma zakres 0–1 i im niższy, tym lepiej. Luka kalibracji to faktyczna trafność minus średnie prawdopodobieństwo modelu. PUSH i VOID są pomijane w obu metrykach.
      </div>

      <Card>
        <CardHeader><CardTitle>Filtry kalibracji</CardTitle></CardHeader>
        <CardContent>
          <Form action="/journal/calibration" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Select name="leagueId" defaultValue={leagueId ?? ""}>
              <option value="">Wszystkie ligi</option>
              {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
            </Select>
            <Select name="seasonId" defaultValue={seasonId ?? ""}>
              <option value="">Wszystkie sezony</option>
              {seasons.map((season) => <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>)}
            </Select>
            <Select name="statKey" defaultValue={statKey ?? ""}>
              <option value="">Wszystkie rynki</option>
              {TREND_STAT_DEFINITIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </Select>
            <Select name="source" defaultValue={source ?? ""}>
              <option value="">Wszystkie źródła</option>
              {Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select name="status" defaultValue={status ?? ""}>
              <option value="">Wszystkie statusy</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Input name="from" type="date" defaultValue={fromText} aria-label="Data od" />
            <Input name="to" type="date" defaultValue={toText} aria-label="Data do" />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Filtruj</Button>
              <Link href="/journal/calibration" className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Wyczyść</Link>
            </div>
          </Form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Card className="p-4">
          <Target size={18} className="mb-2 text-emerald-600" />
          <div className="text-xs text-zinc-500">Snapshoty modelu</div>
          <div className="mt-1 text-3xl font-semibold">{summary.snapshotEntries}</div>
          <div className="text-xs text-zinc-500">z {summary.totalEntries} pozycji · {percent(summary.snapshotCoverage)}</div>
        </Card>
        <Card className="p-4">
          <TrendingUp size={18} className="mb-2 text-amber-600" />
          <div className="text-xs text-zinc-500">Obserwowane</div>
          <div className="mt-1 text-3xl font-semibold">{summary.watching}</div>
          <div className="text-xs text-zinc-500">snapshoty bez zagrania</div>
        </Card>
        <Card className="p-4">
          <WalletCards size={18} className="mb-2 text-blue-600" />
          <div className="text-xs text-zinc-500">Zagrane otwarte</div>
          <div className="mt-1 text-3xl font-semibold">{summary.playedOpen}</div>
          <div className="text-xs text-zinc-500">oczekują na wynik</div>
        </Card>
        <Card className="p-4">
          <Calculator size={18} className="mb-2 text-emerald-600" />
          <div className="text-xs text-zinc-500">Rozliczone W/L</div>
          <div className="mt-1 text-3xl font-semibold">{summary.resolvedEntries}</div>
          <div className="text-xs text-zinc-500">{summary.wins}T · {summary.losses}N</div>
        </Card>
        <Card className="p-4">
          <BarChart3 size={18} className="mb-2 text-emerald-600" />
          <div className="text-xs text-zinc-500">Brier Score</div>
          <div className="mt-1 text-3xl font-semibold">{brier(summary.brierScore)}</div>
          <div className="text-xs text-zinc-500">niżej oznacza lepiej</div>
        </Card>
        <Card className="p-4">
          <TrendingUp size={18} className="mb-2 text-emerald-600" />
          <div className="text-xs text-zinc-500">Luka kalibracji</div>
          <div className={`mt-1 text-3xl font-semibold ${gapClass(summary.calibrationGap)}`}>{signedPercent(summary.calibrationGap)}</div>
          <div className="text-xs text-zinc-500">trafność {percent(summary.actualHitRate)} vs model {percent(summary.averageModelProbability)}</div>
        </Card>
      </div>

      <CalibrationTable
        title="Kalibracja według prawdopodobieństwa"
        rows={journal.calibration.byProbability}
        description="Każdy przedział porównuje średnią prognozę z faktyczną trafnością tej samej próby."
      />
      <CalibrationTable
        title="Wynik według zapisanego EV"
        rows={journal.calibration.byExpectedValue}
        description="ROI jest liczone tylko dla rozliczonych pozycji z kursem i stawką."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <CalibrationTable title="Według ligi" rows={journal.calibration.byLeague} />
        <CalibrationTable title="Według rynku" rows={journal.calibration.byMarket} />
        <CalibrationTable title="OVER / UNDER" rows={journal.calibration.bySide} />
        <CalibrationTable title="Według wersji modelu" rows={journal.calibration.byModelVersion} />
        <div className="xl:col-span-2">
          <CalibrationTable
            title="Według statusu decyzji"
            rows={journal.calibration.byDecisionStatus}
            description="Nierozliczone statusy pokazują liczebność snapshotów, ale nie tworzą trafności ani Brier Score."
          />
        </div>
      </div>
    </div>
  );
}
