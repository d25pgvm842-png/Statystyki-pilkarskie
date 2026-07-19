import Form from "next/form";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Download,
  Search,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requireUser } from "@/lib/auth";
import { loadMarketScanner } from "@/lib/data/market-scanner";
import { prisma } from "@/lib/db";
import {
  scannerEvidenceLabel,
  type ScannerEvidenceStatus,
} from "@/lib/stats/market-scanner";
import {
  type BacktestLookback,
  type BacktestSide,
} from "@/lib/stats/market-backtest";
import {
  TREND_STAT_DEFINITIONS,
  presetLines,
  type TrendStatKey,
} from "@/lib/stats/trends";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function numericParam(
  value: string | string[] | undefined,
  fallback: number,
  minimum = 0,
) {
  const parsed = Number(stringParam(value));
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

function lookbackParam(value: string): BacktestLookback {
  if (value === "5" || value === "10" || value === "20") {
    return Number(value) as 5 | 10 | 20;
  }
  return value === "all" ? null : 10;
}

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${formatNumber(value, 1)}%`;
}

function statusClass(status: ScannerEvidenceStatus) {
  if (status === "SUPPORTED") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (status === "WATCH") return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (status === "WEAK") return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
}

export default async function ScannerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const now = new Date();

  const seasons = await prisma.season.findMany({
    where: {
      league: { active: true },
      matches: {
        some: {
          status: "SCHEDULED",
          kickoffAt: { gte: now },
        },
      },
    },
    include: { league: true },
    orderBy: [{ startsAt: "desc" }, { league: { name: "asc" } }],
  });

  const selectedSeason =
    seasons.find((season) => season.id === stringParam(params.seasonId))
    ?? seasons[0];

  const requestedStat = stringParam(params.statKey);
  const statKey = TREND_STAT_DEFINITIONS.some((item) => item.key === requestedStat)
    ? requestedStat as TrendStatKey
    : "corners";
  const popularLines = presetLines(statKey, "MATCH_TOTAL");
  const defaultThreshold = popularLines[1] ?? popularLines[0] ?? 9.5;
  const threshold = numericParam(params.threshold, defaultThreshold);
  const requestedSide = stringParam(params.side);
  const side = ["OVER", "UNDER", "BOTH"].includes(requestedSide)
    ? requestedSide as BacktestSide
    : "BOTH";
  const lookback = lookbackParam(stringParam(params.lookback) || "10");
  const minSample = [1, 2, 3, 5, 10].includes(Number(stringParam(params.minSample)))
    ? Number(stringParam(params.minSample))
    : 3;
  const minEdge = numericParam(params.minEdge, 0.5);
  const days = [3, 7, 14, 30, 60].includes(Number(stringParam(params.days)))
    ? Number(stringParam(params.days))
    : 14;
  const requestedStatus = stringParam(params.status);
  const status = ["ALL", "SUPPORTED", "WATCH", "WEAK", "UNVERIFIED"].includes(requestedStatus)
    ? requestedStatus
    : "ALL";

  const [loaded, customLines] = await Promise.all([
    selectedSeason
      ? loadMarketScanner({
          seasonId: selectedSeason.id,
          statKey,
          threshold,
          side,
          lookback,
          minSample,
          minEdge,
          days,
          now,
        })
      : Promise.resolve(null),
    prisma.customLine.findMany({
      where: {
        userId: user.id,
        active: true,
        scope: "MATCH_TOTAL",
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const summary = loaded?.summary ?? null;
  const visibleCandidates = summary?.candidates.filter(
    (candidate) => status === "ALL" || candidate.evidenceStatus === status,
  ) ?? [];

  const query = new URLSearchParams();
  if (selectedSeason) query.set("seasonId", selectedSeason.id);
  query.set("statKey", statKey);
  query.set("threshold", String(threshold));
  query.set("side", side);
  query.set("lookback", lookback === null ? "all" : String(lookback));
  query.set("minSample", String(minSample));
  query.set("minEdge", String(minEdge));
  query.set("days", String(days));
  query.set("status", status);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Search className="text-emerald-600" size={24} />
            <h1 className="text-2xl font-semibold">Skaner rynkowy</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Nadchodzące mecze spełniające warunki projekcji, próby i historycznego backtestu.
          </p>
        </div>
        {summary ? (
          <Link
            href={`/scanner/export?${query.toString()}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <Download size={16} className="mr-2" />Eksport CSV
          </Link>
        ) : null}
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
        Skaner nie tworzy typów bukmacherskich ani nie uwzględnia kursu. Pokazuje mecze, w których model ma pełną projekcję i przekracza ustawioną linię o wymaganą wartość.
      </div>

      <Card>
        <CardContent>
          <Form action="/scanner" className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_0.65fr_0.75fr_0.7fr_0.7fr_0.7fr_0.65fr_auto]">
            <Select name="seasonId" defaultValue={selectedSeason?.id}>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>
              ))}
            </Select>
            <Select name="statKey" defaultValue={statKey}>
              {TREND_STAT_DEFINITIONS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </Select>
            <Input name="threshold" type="number" min="0" max="500" step="0.5" defaultValue={threshold} aria-label="Linia" />
            <Select name="side" defaultValue={side}>
              <option value="BOTH">Over lub under</option>
              <option value="OVER">Tylko over</option>
              <option value="UNDER">Tylko under</option>
            </Select>
            <Select name="lookback" defaultValue={lookback === null ? "all" : String(lookback)}>
              <option value="5">Historia 5</option>
              <option value="10">Historia 10</option>
              <option value="20">Historia 20</option>
              <option value="all">Cała historia</option>
            </Select>
            <Select name="minSample" defaultValue={String(minSample)}>
              <option value="1">min. próba 1</option>
              <option value="2">min. próba 2</option>
              <option value="3">min. próba 3</option>
              <option value="5">min. próba 5</option>
              <option value="10">min. próba 10</option>
            </Select>
            <Input name="minEdge" type="number" min="0" max="20" step="0.25" defaultValue={minEdge} aria-label="Minimalna przewaga" />
            <Select name="days" defaultValue={String(days)}>
              <option value="3">3 dni</option>
              <option value="7">7 dni</option>
              <option value="14">14 dni</option>
              <option value="30">30 dni</option>
              <option value="60">60 dni</option>
            </Select>
            <Button type="submit"><Search size={16} className="mr-2" />Skanuj</Button>
          </Form>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-500">Popularne linie:</span>
            {popularLines.map((line) => {
              const quick = new URLSearchParams(query);
              quick.set("threshold", String(line));
              return (
                <Link
                  key={line}
                  href={`/scanner?${quick.toString()}`}
                  className={`rounded-full border px-2.5 py-1 ${line === threshold ? "border-emerald-500 text-emerald-600" : "border-zinc-200 dark:border-zinc-700"}`}
                >
                  {line}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {customLines.length ? (
        <Card>
          <CardHeader><CardTitle>Twoje zapisane linie sumy meczu</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {customLines.map((line) => {
              const quick = new URLSearchParams(query);
              quick.set("statKey", line.statKey);
              quick.set("threshold", String(line.threshold));
              return (
                <Link key={line.id} href={`/scanner?${quick.toString()}`} className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm hover:border-emerald-500 dark:border-zinc-700">
                  {line.name} · {line.threshold}
                </Link>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {!summary ? (
        <Card className="p-10 text-center text-zinc-500">
          Brak przyszłych meczów w aktywnych ligach.
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Card className="p-4">
              <Target size={18} className="mb-2 text-emerald-600" />
              <div className="text-xs text-zinc-500">Nadchodzące mecze</div>
              <div className="mt-1 text-3xl font-semibold">{summary.upcomingTotal}</div>
              <div className="text-xs text-zinc-500">najbliższe {days} dni</div>
            </Card>
            <Card className="p-4">
              <Activity size={18} className="mb-2 text-emerald-600" />
              <div className="text-xs text-zinc-500">Pełne projekcje</div>
              <div className="mt-1 text-3xl font-semibold">{summary.fullProjections}</div>
              <div className="text-xs text-zinc-500">obie strony modelu</div>
            </Card>
            <Card className="p-4">
              <Search size={18} className="mb-2 text-emerald-600" />
              <div className="text-xs text-zinc-500">Kandydaci</div>
              <div className="mt-1 text-3xl font-semibold">{summary.candidatesTotal}</div>
              <div className="text-xs text-zinc-500">po filtrze przewagi</div>
            </Card>
            <Card className="p-4">
              <TrendingUp size={18} className="mb-2 text-emerald-600" />
              <div className="text-xs text-zinc-500">Wsparte historią</div>
              <div className="mt-1 text-3xl font-semibold">{summary.supportedCandidates}</div>
              <div className="text-xs text-zinc-500">najmocniejszy status</div>
            </Card>
            <Card className="p-4">
              <Activity size={18} className="mb-2 text-emerald-600" />
              <div className="text-xs text-zinc-500">Backtest linii</div>
              <div className="mt-1 text-3xl font-semibold">{percent(summary.calibration.hitRate)}</div>
              <div className="text-xs text-zinc-500">{summary.calibration.signals} sygnałów</div>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kalibracja historyczna wybranych ustawień</CardTitle>
              <p className="text-sm text-zinc-500">
                Ta sama linia, kierunek, historia, minimalna próba i minimalna przewaga zostały sprawdzone na zakończonych meczach sezonu.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Sygnały</div><div className="mt-1 text-2xl font-semibold">{summary.calibration.signals}</div></div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Trafność</div><div className="mt-1 text-2xl font-semibold">{percent(summary.calibration.hitRate)}</div></div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">MAE</div><div className="mt-1 text-2xl font-semibold">{formatNumber(summary.calibration.meanAbsoluteError)}</div></div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Bias</div><div className="mt-1 text-2xl font-semibold">{formatNumber(summary.calibration.bias)}</div></div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Pokrycie</div><div className="mt-1 text-2xl font-semibold">{percent(summary.calibration.coverage)}</div></div>
            </CardContent>
          </Card>

          {summary.calibration.signals < 20 ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Słaba kalibracja historyczna</div>
                <div className="mt-1 text-xs">Backtest ma mniej niż 20 sygnałów. Statusów skanera nie należy traktować jako stabilnego potwierdzenia.</div>
              </div>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Filtr statusu historycznego</CardTitle>
              <p className="text-sm text-zinc-500">
                „Wsparte historią” wymaga co najmniej 20 sygnałów dla kierunku, 8 dla podobnej przewagi oraz minimum 55% trafności w obu grupach.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {[
                ["ALL", "Wszystkie"],
                ["SUPPORTED", "Wsparte historią"],
                ["WATCH", "Do obserwacji"],
                ["UNVERIFIED", "Niezweryfikowane"],
                ["WEAK", "Słaba historia"],
              ].map(([value, label]) => {
                const quick = new URLSearchParams(query);
                quick.set("status", value);
                return (
                  <Link
                    key={value}
                    href={`/scanner?${quick.toString()}`}
                    className={`rounded-full border px-3 py-1.5 text-sm ${status === value ? "border-emerald-500 text-emerald-600" : "border-zinc-200 dark:border-zinc-700"}`}
                  >
                    {label}
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Kandydaci rynkowi</CardTitle>
              <p className="text-sm text-zinc-500">
                Posortowane według statusu historycznego, następnie przewagi projekcji i terminu.
              </p>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1350px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/70">
                  <tr>
                    <th className="p-3">Termin</th>
                    <th className="p-3">Mecz</th>
                    <th className="p-3">Sygnał</th>
                    <th className="p-3">Projekcja</th>
                    <th className="p-3">Linia</th>
                    <th className="p-3">Przewaga</th>
                    <th className="p-3">Projekcja H/A</th>
                    <th className="p-3">Próba H/A</th>
                    <th className="p-3">Historia kierunku</th>
                    <th className="p-3">Historia przewagi</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Analiza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {visibleCandidates.map((row) => (
                    <tr key={row.matchId}>
                      <td className="p-3 text-zinc-500">
                        {new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" }).format(row.kickoffAt)}
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{row.homeTeamName} – {row.awayTeamName}</div>
                        <div className="text-xs text-zinc-500">kolejka {row.round ?? "—"}</div>
                      </td>
                      <td className="p-3 text-lg font-semibold">{row.side}</td>
                      <td className="p-3 text-lg font-semibold">{formatNumber(row.projection)}</td>
                      <td className="p-3">{row.threshold}</td>
                      <td className="p-3 font-semibold">{formatNumber(row.edge)}</td>
                      <td className="p-3">{formatNumber(row.projectedHome)} / {formatNumber(row.projectedAway)}</td>
                      <td className="p-3">{row.homeSample}/{row.awaySample}</td>
                      <td className="p-3">{percent(row.sideBacktestHitRate)}<div className="text-xs text-zinc-500">n={row.sideBacktestSignals}</div></td>
                      <td className="p-3">{percent(row.edgeBacktestHitRate)}<div className="text-xs text-zinc-500">n={row.edgeBacktestSignals}</div></td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(row.evidenceStatus)}`}>
                          {scannerEvidenceLabel(row.evidenceStatus)}
                        </span>
                      </td>
                      <td className="p-3">
                        <Link href={`/analysis?matchId=${row.matchId}&lookback=${lookback === null ? "all" : lookback}`} className="font-medium text-emerald-600 hover:underline">
                          Otwórz
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!visibleCandidates.length ? (
                    <tr><td colSpan={12} className="p-10 text-center text-zinc-500">Brak kandydatów dla wybranych ustawień lub statusu.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Diagnostyka odrzuconych meczów</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Brak pełnej projekcji</div><div className="mt-1 text-2xl font-semibold">{summary.skippedMissingProjection}</div></div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Za mała próba</div><div className="mt-1 text-2xl font-semibold">{summary.skippedSample}</div></div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Za mała przewaga lub zły kierunek</div><div className="mt-1 text-2xl font-semibold">{summary.skippedNoEdge}</div></div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
