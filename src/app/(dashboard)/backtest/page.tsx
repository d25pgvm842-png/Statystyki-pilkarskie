import Form from "next/form";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Download,
  FlaskConical,
  Search,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requireUser } from "@/lib/auth";
import { loadMarketBacktest } from "@/lib/data/market-backtest";
import { prisma } from "@/lib/db";
import {
  type BacktestLookback,
  type BacktestResult,
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

function resultLabel(result: BacktestResult) {
  if (result === "WIN") return "trafiony";
  if (result === "LOSS") return "nietrafiony";
  return "push";
}

function resultClass(result: BacktestResult) {
  if (result === "WIN") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (result === "LOSS") return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

export default async function BacktestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const seasons = await prisma.season.findMany({
    where: {
      league: { active: true },
      matches: { some: { status: "FINISHED" } },
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

  const [loaded, customLines] = await Promise.all([
    selectedSeason
      ? loadMarketBacktest({
          seasonId: selectedSeason.id,
          statKey,
          threshold,
          side,
          lookback,
          minSample,
          minEdge,
        })
      : Promise.resolve(null),
    prisma.customLine.findMany({
      where: {
        userId: user.id,
        active: true,
        scope: "MATCH_TOTAL",
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const summary = loaded?.summary ?? null;
  const query = new URLSearchParams();
  if (selectedSeason) query.set("seasonId", selectedSeason.id);
  query.set("statKey", statKey);
  query.set("threshold", String(threshold));
  query.set("side", side);
  query.set("lookback", lookback === null ? "all" : String(lookback));
  query.set("minSample", String(minSample));
  query.set("minEdge", String(minEdge));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="text-emerald-600" size={24} />
            <h1 className="text-2xl font-semibold">Backtester projekcji rynkowych</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Historyczna weryfikacja projekcji bez używania danych z przyszłości.
          </p>
        </div>
        {summary ? (
          <Link
            href={`/backtest/export?${query.toString()}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <Download size={16} className="mr-2" />Eksport CSV
          </Link>
        ) : null}
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
        Backtest mierzy trafność sygnałów i błąd modelu. Nie pokazuje rentowności, ponieważ aplikacja nie posiada historycznych kursów ani marży bukmachera.
      </div>

      <Card>
        <CardContent>
          <Form action="/backtest" className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_0.7fr_0.75fr_0.7fr_0.7fr_0.7fr_auto]">
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
            <Input name="minEdge" type="number" min="0" max="20" step="0.25" defaultValue={minEdge} aria-label="Minimalna przewaga projekcji nad linią" />
            <Button type="submit"><Search size={16} className="mr-2" />Uruchom</Button>
          </Form>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-500">Popularne linie:</span>
            {popularLines.map((line) => {
              const quick = new URLSearchParams(query);
              quick.set("threshold", String(line));
              return (
                <Link
                  key={line}
                  href={`/backtest?${quick.toString()}`}
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
                <Link key={line.id} href={`/backtest?${quick.toString()}`} className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm hover:border-emerald-500 dark:border-zinc-700">
                  {line.name} · {line.threshold}
                </Link>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {!summary ? (
        <Card className="p-10 text-center text-zinc-500">
          Brak zakończonych meczów do przeprowadzenia backtestu.
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Card className="p-4">
              <Target size={18} className="mb-2 text-emerald-600" />
              <div className="text-xs text-zinc-500">Sygnały</div>
              <div className="mt-1 text-3xl font-semibold">{summary.signals}</div>
              <div className="text-xs text-zinc-500">{summary.wins}T · {summary.losses}N · {summary.pushes}P</div>
            </Card>
            <Card className="p-4">
              <TrendingUp size={18} className="mb-2 text-emerald-600" />
              <div className="text-xs text-zinc-500">Trafność</div>
              <div className="mt-1 text-3xl font-semibold">{percent(summary.hitRate)}</div>
              <div className="text-xs text-zinc-500">push pominięty w mianowniku</div>
            </Card>
            <Card className="p-4">
              <Activity size={18} className="mb-2 text-emerald-600" />
              <div className="text-xs text-zinc-500">Pokrycie sygnałem</div>
              <div className="mt-1 text-3xl font-semibold">{percent(summary.coverage)}</div>
              <div className="text-xs text-zinc-500">{summary.signals}/{summary.eligibleMatches} kwalifikujących się</div>
            </Card>
            <Card className="p-4">
              <FlaskConical size={18} className="mb-2 text-emerald-600" />
              <div className="text-xs text-zinc-500">Średni błąd MAE</div>
              <div className="mt-1 text-3xl font-semibold">{formatNumber(summary.meanAbsoluteError)}</div>
              <div className="text-xs text-zinc-500">bias {formatNumber(summary.bias)}</div>
            </Card>
            <Card className="p-4">
              <Target size={18} className="mb-2 text-emerald-600" />
              <div className="text-xs text-zinc-500">Średnia przewaga</div>
              <div className="mt-1 text-3xl font-semibold">{formatNumber(summary.averageEdge)}</div>
              <div className="text-xs text-zinc-500">linia {summary.threshold}</div>
            </Card>
          </div>

          {summary.signals < 20 ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Mała próba backtestu</div>
                <div className="mt-1 text-xs">Wynik opiera się na mniej niż 20 sygnałach. Nie traktuj go jako stabilnej przewagi modelu.</div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Skuteczność według przewagi projekcji</CardTitle>
                <p className="text-sm text-zinc-500">Przewaga to bezwzględna odległość projekcji od testowanej linii.</p>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/70">
                    <tr><th className="p-3">Przewaga</th><th className="p-3">Sygnały</th><th className="p-3">T/N/P</th><th className="p-3">Trafność</th><th className="p-3">Śr. przewaga</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {summary.edgeBreakdown.map((row) => (
                      <tr key={row.key}>
                        <td className="p-3 font-medium">{row.label}</td>
                        <td className="p-3">{row.signals}</td>
                        <td className="p-3">{row.wins}/{row.losses}/{row.pushes}</td>
                        <td className="p-3 font-semibold">{percent(row.hitRate)}</td>
                        <td className="p-3">{formatNumber(row.averageEdge)}</td>
                      </tr>
                    ))}
                    {!summary.edgeBreakdown.length ? <tr><td colSpan={5} className="p-8 text-center text-zinc-500">Brak sygnałów.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader><CardTitle>Wyniki miesięczne</CardTitle></CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/70">
                    <tr><th className="p-3">Miesiąc</th><th className="p-3">Sygnały</th><th className="p-3">T/N/P</th><th className="p-3">Trafność</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {summary.monthlyBreakdown.map((row) => (
                      <tr key={row.key}>
                        <td className="p-3 font-medium">{row.label}</td>
                        <td className="p-3">{row.signals}</td>
                        <td className="p-3">{row.wins}/{row.losses}/{row.pushes}</td>
                        <td className="p-3 font-semibold">{percent(row.hitRate)}</td>
                      </tr>
                    ))}
                    {!summary.monthlyBreakdown.length ? <tr><td colSpan={4} className="p-8 text-center text-zinc-500">Brak sygnałów.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Sygnały historyczne</CardTitle>
              <p className="text-sm text-zinc-500">
                Każdy wiersz został policzony wyłącznie na danych dostępnych przed terminem meczu.
              </p>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/70">
                  <tr>
                    <th className="p-3">Termin</th>
                    <th className="p-3">Mecz</th>
                    <th className="p-3">Sygnał</th>
                    <th className="p-3">Projekcja</th>
                    <th className="p-3">Linia</th>
                    <th className="p-3">Przewaga</th>
                    <th className="p-3">Wynik stat.</th>
                    <th className="p-3">Próba H/A</th>
                    <th className="p-3">Ocena</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {summary.signalsRows.map((row) => (
                    <tr key={row.matchId}>
                      <td className="p-3 text-zinc-500">{new Intl.DateTimeFormat("pl-PL", { dateStyle: "short" }).format(row.kickoffAt)}</td>
                      <td className="p-3">
                        <Link href={`/matches/${row.matchId}`} className="font-medium hover:text-emerald-600">
                          {row.homeTeamName} – {row.awayTeamName}
                        </Link>
                        <div className="text-xs text-zinc-500">kolejka {row.round ?? "—"}</div>
                      </td>
                      <td className="p-3 font-semibold">{row.side}</td>
                      <td className="p-3">{formatNumber(row.projection)}</td>
                      <td className="p-3">{row.threshold}</td>
                      <td className="p-3">{formatNumber(row.edge)}</td>
                      <td className="p-3 font-semibold">{row.actual}</td>
                      <td className="p-3">{row.homeSample}/{row.awaySample}</td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${resultClass(row.result)}`}>
                          {resultLabel(row.result)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!summary.signalsRows.length ? <tr><td colSpan={9} className="p-10 text-center text-zinc-500">Brak sygnałów dla wybranych warunków.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Drużyny najczęściej występujące w sygnałach</CardTitle>
              <p className="text-sm text-zinc-500">Każdy mecz jest przypisany do obu uczestniczących drużyn.</p>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/70">
                  <tr><th className="p-3">Drużyna</th><th className="p-3">Sygnały</th><th className="p-3">T/N/P</th><th className="p-3">Trafność</th><th className="p-3">Śr. przewaga</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {summary.teamBreakdown.slice(0, 12).map((row) => (
                    <tr key={row.teamId}>
                      <td className="p-3"><Link href={`/teams/${row.teamId}?seasonId=${selectedSeason?.id ?? ""}`} className="font-medium hover:text-emerald-600">{row.teamName}</Link></td>
                      <td className="p-3">{row.signals}</td>
                      <td className="p-3">{row.wins}/{row.losses}/{row.pushes}</td>
                      <td className="p-3 font-semibold">{percent(row.hitRate)}</td>
                      <td className="p-3">{formatNumber(row.averageEdge)}</td>
                    </tr>
                  ))}
                  {!summary.teamBreakdown.length ? <tr><td colSpan={5} className="p-8 text-center text-zinc-500">Brak sygnałów.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Diagnostyka odrzuconych meczów</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Brak rzeczywistej statystyki</div><div className="mt-1 text-2xl font-semibold">{summary.skippedMissingActual}</div></div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Brak pełnej projekcji</div><div className="mt-1 text-2xl font-semibold">{summary.skippedMissingProjection}</div></div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Za mała historia</div><div className="mt-1 text-2xl font-semibold">{summary.skippedSample}</div></div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Za mała przewaga</div><div className="mt-1 text-2xl font-semibold">{summary.skippedNoEdge}</div></div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
