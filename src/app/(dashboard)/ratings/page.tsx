import Form from "next/form";
import Link from "next/link";
import {
  BarChart3,
  Download,
  Layers3,
  Search,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { loadMarketRatings } from "@/lib/data/market-ratings";
import {
  marketRatingQualityLabel,
  marketStrengthBucketLabel,
  type RatingLookback,
  type RatingQuality,
  type RatingScope,
  type RatingVenue,
  type StrengthBucket,
} from "@/lib/stats/market-ratings";
import {
  TREND_STAT_DEFINITIONS,
  type TrendStatKey,
} from "@/lib/stats/trends";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const scopeLabels: Record<RatingScope, string> = {
  TEAM_FOR: "Drużyna wykonuje",
  TEAM_AGAINST: "Drużyna oddaje rywalom",
  MATCH_TOTAL: "Suma w meczach drużyny",
};

const venueLabels: Record<RatingVenue, string> = {
  ALL: "Wszystkie mecze",
  HOME: "Tylko u siebie",
  AWAY: "Tylko na wyjeździe",
};

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function ratingLookback(value: string): RatingLookback {
  if (value === "5" || value === "10" || value === "20") return Number(value) as 5 | 10 | 20;
  return value === "all" ? null : 10;
}

function strengthBucketParam(value: string): StrengthBucket | null {
  if (value === "1" || value === "2" || value === "3" || value === "4") {
    return Number(value) as StrengthBucket;
  }
  return null;
}

function bucketClass(value: StrengthBucket | null) {
  if (value === 1) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (value === 2) return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (value === 3) return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  if (value === 4) return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}

function qualityClass(value: RatingQuality) {
  if (value === "STRONG") return "text-emerald-600";
  if (value === "MODERATE") return "text-blue-600";
  if (value === "WEAK") return "text-amber-600";
  return "text-zinc-500";
}

export default async function RatingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const seasons = await prisma.season.findMany({
    where: { league: { active: true } },
    include: { league: true },
    orderBy: [{ active: "desc" }, { startsAt: "desc" }],
  });
  const selectedSeason =
    seasons.find((season) => season.id === stringParam(params.seasonId))
    ?? seasons.find((season) => season.active)
    ?? seasons[0];

  const requestedStat = stringParam(params.statKey);
  const statKey = TREND_STAT_DEFINITIONS.some((item) => item.key === requestedStat)
    ? requestedStat as TrendStatKey
    : "corners";
  const requestedScope = stringParam(params.scope);
  const scope = ["TEAM_FOR", "TEAM_AGAINST", "MATCH_TOTAL"].includes(requestedScope)
    ? requestedScope as RatingScope
    : "TEAM_FOR";
  const requestedVenue = stringParam(params.venue);
  const venue = ["ALL", "HOME", "AWAY"].includes(requestedVenue)
    ? requestedVenue as RatingVenue
    : "ALL";
  const lookbackText = stringParam(params.lookback) || "10";
  const lookback = ratingLookback(lookbackText);
  const minSample = [1, 3, 5, 10].includes(Number(stringParam(params.minSample)))
    ? Number(stringParam(params.minSample))
    : 3;
  const selectedBucket = strengthBucketParam(stringParam(params.bucket));

  const loaded = selectedSeason
    ? await loadMarketRatings({
        seasonId: selectedSeason.id,
        statKey,
        scope,
        venue,
        lookback,
        minSample,
      })
    : null;

  const ratings = loaded?.ratings ?? null;
  const visibleRows = ratings?.rows.filter(
    (row) => selectedBucket === null || row.strengthBucket === selectedBucket,
  ) ?? [];
  const topRows = ratings?.rows.filter((row) => row.rating !== null).slice(0, 2) ?? [];
  const query = new URLSearchParams();
  if (selectedSeason) query.set("seasonId", selectedSeason.id);
  query.set("statKey", statKey);
  query.set("scope", scope);
  query.set("venue", venue);
  query.set("lookback", lookback === null ? "all" : String(lookback));
  query.set("minSample", String(minSample));
  if (selectedBucket !== null) query.set("bucket", String(selectedBucket));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="text-emerald-600" size={24} />
            <h1 className="text-2xl font-semibold">Rankingi rynkowe</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Rating 0–100, percentyl i dynamiczny koszyk 1–4 dla wybranej ligi, sezonu, rynku oraz splitu dom/wyjazd.
          </p>
        </div>
        {ratings ? (
          <Link
            href={`/ratings/export?${query.toString()}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <Download size={16} className="mr-2" />Eksport CSV
          </Link>
        ) : null}
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
        Koszyki są liczone od nowa dla każdej kombinacji ligi, sezonu, rynku, zakresu, miejsca i minimum próby. Koszyk 1 oznacza najwyższą wartość statystyki, nie ogólną siłę drużyny. {ratings?.bucketRule ?? ""}
      </div>

      <Card>
        <CardContent>
          <Form action="/ratings" className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_0.8fr_0.8fr_0.7fr_0.8fr_auto]">
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
            <Select name="scope" defaultValue={scope}>
              {Object.entries(scopeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Select name="venue" defaultValue={venue}>
              {Object.entries(venueLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Select name="lookback" defaultValue={lookback === null ? "all" : String(lookback)}>
              <option value="5">Ostatnie 5</option>
              <option value="10">Ostatnie 10</option>
              <option value="20">Ostatnie 20</option>
              <option value="all">Cały sezon</option>
            </Select>
            <Select name="minSample" defaultValue={String(minSample)}>
              <option value="1">min. 1</option>
              <option value="3">min. 3</option>
              <option value="5">min. 5</option>
              <option value="10">min. 10</option>
            </Select>
            <Select name="bucket" defaultValue={selectedBucket === null ? "" : String(selectedBucket)}>
              <option value="">Wszystkie koszyki</option>
              <option value="1">Koszyk 1</option>
              <option value="2">Koszyk 2</option>
              <option value="3">Koszyk 3</option>
              <option value="4">Koszyk 4</option>
            </Select>
            <Button type="submit"><Search size={16} className="mr-2" />Policz</Button>
          </Form>
        </CardContent>
      </Card>

      {!ratings ? (
        <Card className="p-10 text-center text-zinc-500">Brak sezonu do obliczenia rankingów.</Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4">
              <BarChart3 size={18} className="mb-2 text-emerald-600" />
              <div className="text-xs text-zinc-500">Średnia ligi</div>
              <div className="mt-1 text-3xl font-semibold">{formatNumber(ratings.leagueAverage)}</div>
              <div className="text-xs text-zinc-500">{ratings.statLabel}</div>
            </Card>
            <Card className="p-4">
              <Users size={18} className="mb-2 text-emerald-600" />
              <div className="text-xs text-zinc-500">Drużyny z danymi</div>
              <div className="mt-1 text-3xl font-semibold">{ratings.teamsWithData}/{ratings.teamsTotal}</div>
              <div className="text-xs text-zinc-500">{ratings.eligibleTeams} spełnia minimum próby</div>
            </Card>
            {topRows.map((row, index) => (
              <Card key={row.teamId} className="p-4">
                <Trophy size={18} className="mb-2 text-emerald-600" />
                <div className="text-xs text-zinc-500">#{index + 1} w rankingu</div>
                <div className="mt-1 font-semibold">{row.teamName}</div>
                <div className="text-2xl font-semibold">{formatNumber(row.average)}</div>
                <div className="text-xs text-zinc-500">rating {row.rating} · K{row.strengthBucket} · n={row.sample}</div>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Layers3 size={18} className="text-emerald-600" />
                <CardTitle>Rozkład dynamicznych koszyków</CardTitle>
              </div>
              <p className="text-sm text-zinc-500">
                Granice są percentylowe. Remisy pozostają razem, dlatego koszyki nie muszą mieć identycznej liczby drużyn.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {ratings.bucketSummaries.map((summary) => (
                <div key={summary.bucket} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${bucketClass(summary.bucket)}`}>
                      K{summary.bucket}
                    </span>
                    <span className="text-2xl font-semibold">{summary.teams}</span>
                  </div>
                  <div className="mt-2 text-sm font-medium">{summary.label}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    P{summary.percentileFrom}–{summary.percentileTo}
                  </div>
                  <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    Zakres średniej: {summary.minAverage === null ? "—" : `${formatNumber(summary.minAverage)}–${formatNumber(summary.maxAverage)}`}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>{ratings.statLabel} · {scopeLabels[scope]} · {venueLabels[venue]}</CardTitle>
              <p className="text-sm text-zinc-500">
                Percentyle i koszyki są liczone wyłącznie wśród drużyn spełniających minimum próby. Remisy otrzymują ten sam rating, pozycję i koszyk.
              </p>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/70">
                  <tr>
                    <th className="p-3">Pozycja</th>
                    <th className="p-3">Drużyna</th>
                    <th className="p-3">Próba</th>
                    <th className="p-3">Średnia</th>
                    <th className="p-3">Mediana</th>
                    <th className="p-3">Min–max</th>
                    <th className="p-3">Do ligi</th>
                    <th className="p-3">Rating</th>
                    <th className="p-3">Koszyk 1–4</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {visibleRows.map((row) => (
                    <tr key={row.teamId}>
                      <td className="p-3 text-lg font-semibold">{row.position ?? "—"}</td>
                      <td className="p-3">
                        <Link href={`/teams/${row.teamId}?seasonId=${selectedSeason?.id ?? ""}&lookback=${lookback === null ? "all" : lookback}`} className="font-medium hover:text-emerald-600">
                          {row.teamName}
                        </Link>
                        <div className={`text-xs ${qualityClass(row.quality)}`}>
                          {marketRatingQualityLabel(row.quality)}
                        </div>
                      </td>
                      <td className="p-3">{row.sample}</td>
                      <td className="p-3 text-lg font-semibold">{formatNumber(row.average)}</td>
                      <td className="p-3">{formatNumber(row.median)}</td>
                      <td className="p-3">{row.min ?? "—"}–{row.max ?? "—"}</td>
                      <td className="p-3">
                        {row.delta === null ? "—" : (
                          <>
                            <div className={row.delta >= 0 ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
                              {row.delta >= 0 ? "+" : ""}{formatNumber(row.delta)}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {row.deltaPercent === null ? "" : `${row.deltaPercent >= 0 ? "+" : ""}${formatNumber(row.deltaPercent, 0)}%`}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="p-3">
                        {row.rating === null ? (
                          <span className="text-zinc-500">brak</span>
                        ) : (
                          <div className="min-w-32">
                            <div className="mb-1 flex items-center justify-between gap-3">
                              <span className="text-lg font-semibold">{row.rating}</span>
                              <span className="text-xs text-zinc-500">P{formatNumber(row.percentile, 0)}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${row.rating}%` }} />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${bucketClass(row.strengthBucket)}`}>
                          {marketStrengthBucketLabel(row.strengthBucket)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!visibleRows.length ? (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-zinc-500">
                        Brak drużyn w wybranym koszyku lub brak wystarczającej próby.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
