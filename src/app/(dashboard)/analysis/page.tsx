import Form from "next/form";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BadgePercent,
  Calculator,
  CalendarDays,
  Download,
  Layers3,
  Save,
  Scale,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { createCustomLineAction } from "@/lib/actions/custom-line-actions";
import { saveMatchAnalysisNoteAction } from "@/lib/actions/match-analysis-actions";
import { saveMarketWorkshopPickAction } from "@/lib/actions/market-workshop-actions";
import { requireUser } from "@/lib/auth";
import { loadMatchAnalysis, type AnalysisLookback } from "@/lib/data/match-analysis";
import { loadMarketWorkshop } from "@/lib/data/market-workshop";
import { prisma } from "@/lib/db";
import { marketStrengthBucketLabel } from "@/lib/stats/market-ratings";
import { opponentStrengthQualityLabel } from "@/lib/stats/opponent-strength";
import {
  isHalfLine,
  marketWorkshopConfidenceLabel,
  marketWorkshopStatusLabel,
  marketWorkshopTargetLabel,
  type MarketWorkshopStatus,
  type MarketWorkshopTarget,
} from "@/lib/stats/market-workshop";
import { TREND_STAT_DEFINITIONS, trendDefinition, type TrendStatKey } from "@/lib/stats/trends";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const dynamic = "force-dynamic";

const scopeLabels: Record<string, string> = {
  MATCH_TOTAL: "Suma w meczu",
  TEAM_FOR: "Drużyna – wykonane",
  TEAM_AGAINST: "Drużyna – dopuszczone",
};

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function oddsParam(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 1 && parsed <= 1000 ? parsed : null;
}

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${formatNumber(value, 1)}%`;
}

function workshopTargetParam(value: string): MarketWorkshopTarget {
  if (value === "HOME_TEAM" || value === "AWAY_TEAM") return value;
  return "MATCH_TOTAL";
}

function workshopLineParam(value: string) {
  const parsed = Number(value);
  return isHalfLine(parsed) ? parsed : null;
}

function workshopStatusClass(value: MarketWorkshopStatus) {
  if (value === "POTENTIAL_VALUE") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (value === "WATCH") return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (value === "NO_EDGE") return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
}

function rate(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${formatNumber(value, 0)}%`;
}

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formLabel(form: { wins: number; draws: number; losses: number }) {
  return `${form.wins}Z · ${form.draws}R · ${form.losses}P`;
}

function projectionQualityLabel(value: string) {
  if (value === "FULL") return "pełna";
  if (value === "ONE_SIDED_FOR") return "jednostronna: tylko wykonuje";
  if (value === "ONE_SIDED_AGAINST") return "jednostronna: tylko rywal oddaje";
  return "brak danych";
}

function projectionQualityClass(value: string) {
  if (value === "FULL") return "text-emerald-600";
  if (value === "MISSING") return "text-zinc-500";
  return "text-amber-600";
}

export default async function MatchAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const seasons = await prisma.season.findMany({
    where: { league: { active: true } },
    include: { league: true },
    orderBy: [{ active: "desc" }, { startsAt: "desc" }],
  });
  const selectedSeason =
    seasons.find((season) => season.id === stringParam(params.seasonId))
    ?? seasons.find((season) => season.active)
    ?? seasons[0];
  const matches = selectedSeason
    ? await prisma.match.findMany({
        where: { seasonId: selectedSeason.id },
        include: { homeTeam: true, awayTeam: true, referee: true },
        orderBy: { kickoffAt: "asc" },
      })
    : [];
  const requestedMatchId = stringParam(params.matchId);
  const now = new Date();
  const selectedMatch =
    matches.find((match) => match.id === requestedMatchId)
    ?? matches.find(
      (match) => match.kickoffAt >= now && ["SCHEDULED", "POSTPONED"].includes(match.status),
    )
    ?? matches.at(-1)
    ?? null;
  const lookbackText = stringParam(params.lookback);
  const lookback: AnalysisLookback = ["5", "10", "20"].includes(lookbackText)
    ? Number(lookbackText) as 5 | 10 | 20
    : lookbackText === "all"
      ? null
      : 10;
  const lookbackValue = lookback === null ? "all" : String(lookback);
  const workshopStatParam = stringParam(params.workshopStatKey);
  const workshopStatKey = TREND_STAT_DEFINITIONS.some((item) => item.key === workshopStatParam)
    ? workshopStatParam as TrendStatKey
    : "corners";
  const workshopTarget = workshopTargetParam(stringParam(params.workshopTarget));
  const workshopDefinition = trendDefinition(workshopStatKey)!;
  const defaultWorkshopLines = workshopTarget === "MATCH_TOTAL"
    ? workshopDefinition.totalLines
    : workshopDefinition.teamLines;
  const workshopLineText = stringParam(params.workshopLine);
  const parsedWorkshopLine = workshopLineParam(workshopLineText);
  const workshopLineInvalid = Boolean(workshopLineText) && parsedWorkshopLine === null;
  const workshopLine = parsedWorkshopLine
    ?? defaultWorkshopLines[1]
    ?? defaultWorkshopLines[0];
  const workshopOverOddsText = stringParam(params.workshopOverOdds);
  const workshopUnderOddsText = stringParam(params.workshopUnderOdds);
  const workshopBookmaker = stringParam(params.workshopBookmaker);
  const workshopNote = stringParam(params.workshopNote);
  const workshopOverOdds = oddsParam(workshopOverOddsText);
  const workshopUnderOdds = oddsParam(workshopUnderOddsText);
  const [analysis, workshopLoaded] = selectedMatch
    ? await Promise.all([
        loadMatchAnalysis({ matchId: selectedMatch.id, userId: user.id, lookback }),
        workshopLineInvalid
          ? Promise.resolve(null)
          : loadMarketWorkshop({
              matchId: selectedMatch.id,
              statKey: workshopStatKey,
              target: workshopTarget,
              line: workshopLine,
              lookback,
              overOdds: workshopOverOdds,
              underOdds: workshopUnderOdds,
            }),
      ])
    : [null, null] as const;
  const workshop = workshopLoaded?.workshop ?? null;
  const workshopCapturedAt = new Date().toISOString();

  const currentParams = new URLSearchParams();
  if (selectedSeason) currentParams.set("seasonId", selectedSeason.id);
  if (selectedMatch) currentParams.set("matchId", selectedMatch.id);
  currentParams.set("lookback", lookbackValue);
  currentParams.set("workshopStatKey", workshopStatKey);
  currentParams.set("workshopTarget", workshopTarget);
  currentParams.set("workshopLine", String(workshopLine));
  if (workshopOverOddsText) currentParams.set("workshopOverOdds", workshopOverOddsText);
  if (workshopUnderOddsText) currentParams.set("workshopUnderOdds", workshopUnderOddsText);
  if (workshopBookmaker) currentParams.set("workshopBookmaker", workshopBookmaker);
  if (workshopNote) currentParams.set("workshopNote", workshopNote);
  const returnTo = `/analysis?${currentParams.toString()}`;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="text-emerald-600" size={24} />
            <h1 className="text-2xl font-semibold">Centrum analizy meczu</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Forma, splity dom/wyjazd, projekcje, linie over/under, H2H i profil sędziego w jednym miejscu.
          </p>
        </div>
        {analysis ? (
          <Link
            href={`/analysis/export?matchId=${analysis.match.id}&lookback=${lookbackValue}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <Download size={16} className="mr-2" />Eksport CSV
          </Link>
        ) : null}
      </div>

      {stringParam(params.saved) === "1" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          Notatka analityczna została zapisana.
        </div>
      ) : null}
      {stringParam(params.created) === "1" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          Własna linia została dodana do analizy.
        </div>
      ) : null}

      {workshopLineInvalid ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          Warsztat obsługuje obecnie wyłącznie linie połówkowe, np. 8,5 lub 9,5. Linia całkowita nie została przeliczona.
        </div>
      ) : null}
      {stringParam(params.workshopSaved) ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          Snapshot warsztatu został zapisany w Dzienniku.
        </div>
      ) : null}
      {stringParam(params.workshopAlready) ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          Taki sam mecz, rynek, drużyna, linia i kierunek już znajdują się w Dzienniku.
        </div>
      ) : null}
      {stringParam(params.workshopError) ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          Nie udało się zapisać warsztatu. Sprawdź status meczu oraz kurs wybranej strony.
        </div>
      ) : null}

      <Card>
        <CardContent>
          <Form action="/analysis" className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.6fr_0.7fr_auto]">
            <Select name="seasonId" defaultValue={selectedSeason?.id}>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.league.name} · {season.name}
                </option>
              ))}
            </Select>
            <Select name="matchId" defaultValue={selectedMatch?.id}>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>
                  {new Intl.DateTimeFormat("pl-PL", { dateStyle: "short" }).format(match.kickoffAt)} · {match.homeTeam.name} – {match.awayTeam.name}
                </option>
              ))}
            </Select>
            <Select name="lookback" defaultValue={lookbackValue}>
              <option value="5">Ostatnie 5</option>
              <option value="10">Ostatnie 10</option>
              <option value="20">Ostatnie 20</option>
              <option value="all">Cały sezon</option>
            </Select>
            <Button type="submit"><Target size={16} className="mr-2" />Analizuj</Button>
          </Form>
        </CardContent>
      </Card>

      {!analysis ? (
        <Card className="p-10 text-center text-zinc-500">
          W wybranym sezonie nie ma jeszcze meczów do analizy.
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <div>
                <div className="text-xs uppercase text-zinc-500">Gospodarz</div>
                <div className="mt-1 text-2xl font-semibold">{analysis.match.homeTeam.name}</div>
                <div className="mt-2 text-sm text-zinc-500">{formLabel(analysis.homeForm)} · {formatNumber(analysis.homeForm.pointsPerMatch)} pkt/mecz</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium">{analysis.match.season.league.name} · {analysis.match.season.name}</div>
                <div className="mt-1 text-xs text-zinc-500">{dateTime(analysis.match.kickoffAt)}</div>
                <div className="mt-2 text-sm">Kolejka {analysis.match.round ?? "—"}</div>
              </div>
              <div className="lg:text-right">
                <div className="text-xs uppercase text-zinc-500">Gość</div>
                <div className="mt-1 text-2xl font-semibold">{analysis.match.awayTeam.name}</div>
                <div className="mt-2 text-sm text-zinc-500">{formLabel(analysis.awayForm)} · {formatNumber(analysis.awayForm.pointsPerMatch)} pkt/mecz</div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Card className="p-4"><CalendarDays size={18} className="mb-2 text-emerald-600" /><div className="text-xs text-zinc-500">Termin</div><div className="mt-1 font-medium">{dateTime(analysis.match.kickoffAt)}</div></Card>
            <Card className="p-4"><Users size={18} className="mb-2 text-emerald-600" /><div className="text-xs text-zinc-500">Próba formy</div><div className="mt-1 font-medium">{analysis.homeForm.count}/{analysis.awayForm.count} meczów</div></Card>
            <Card className="p-4"><TrendingUp size={18} className="mb-2 text-emerald-600" /><div className="text-xs text-zinc-500">Próba splitów</div><div className="mt-1 font-medium">{analysis.homeVenue.length}/{analysis.awayVenue.length} dom/wyjazd</div></Card>
            <Card className="p-4"><Scale size={18} className="mb-2 text-emerald-600" /><div className="text-xs text-zinc-500">Sędzia</div><div className="mt-1 font-medium">{analysis.match.referee?.name ?? "Brak w źródle"}</div></Card>
            <Card className="p-4"><Target size={18} className="mb-2 text-emerald-600" /><div className="text-xs text-zinc-500">Źródło meczu</div><div className="mt-1 font-medium">{analysis.match.dataSource?.name ?? "Brak"}</div></Card>
          </div>

          {analysis.weakMarkets.length ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Ograniczona próba dla części rynków</div>
                <div className="mt-1 text-xs">
                  {analysis.weakMarkets.map((market) => market.shortLabel).join(", ")}. Projekcje jednostronne albo z próbą poniżej 3 meczów traktuj wyłącznie jako orientacyjne.
                </div>
              </div>
            </div>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Layers3 size={18} />Korekta siłą wcześniejszych rywali</CardTitle>
              <p className="text-sm text-zinc-500">
                Surowa średnia pozostaje bez zmian. Wartość skorygowana dodaje do średniej ligi różnicę drużyny względem oczekiwań przeciw koszykom wcześniejszych rywali.
              </p>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/70">
                  <tr>
                    <th className="p-3">Rynek</th>
                    <th className="p-3">Gospodarz surowa</th>
                    <th className="p-3">Korekta</th>
                    <th className="p-3">Gospodarz skorygowana</th>
                    <th className="p-3">Koszyk obronny gościa</th>
                    <th className="p-3">Gość surowa</th>
                    <th className="p-3">Korekta</th>
                    <th className="p-3">Gość skorygowana</th>
                    <th className="p-3">Koszyk obronny gospodarza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {analysis.opponentStrength.map((row) => (
                    <tr key={row.key}>
                      <td className="p-3 font-medium">{row.label}</td>
                      <td className="p-3">{formatNumber(row.home.rawAverage)}<div className="text-xs text-zinc-500">n={row.home.sample}</div></td>
                      <td className={`p-3 font-medium ${row.home.adjustment === null ? "text-zinc-500" : row.home.adjustment >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {row.home.adjustment === null ? "—" : `${row.home.adjustment >= 0 ? "+" : ""}${formatNumber(row.home.adjustment)}`}
                        <div className="text-xs font-normal text-zinc-500">{opponentStrengthQualityLabel(row.home.quality)} · n={row.home.comparableSample}</div>
                      </td>
                      <td className="p-3 text-lg font-semibold">{formatNumber(row.home.adjustedAverage)}</td>
                      <td className="p-3">
                        {row.home.currentOpponent?.bucket ? `K${row.home.currentOpponent.bucket}` : "—"}
                        <div className="text-xs text-zinc-500">{marketStrengthBucketLabel(row.home.currentOpponent?.bucket ?? null)} · n={row.home.currentOpponent?.sample ?? 0}</div>
                      </td>
                      <td className="p-3">{formatNumber(row.away.rawAverage)}<div className="text-xs text-zinc-500">n={row.away.sample}</div></td>
                      <td className={`p-3 font-medium ${row.away.adjustment === null ? "text-zinc-500" : row.away.adjustment >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {row.away.adjustment === null ? "—" : `${row.away.adjustment >= 0 ? "+" : ""}${formatNumber(row.away.adjustment)}`}
                        <div className="text-xs font-normal text-zinc-500">{opponentStrengthQualityLabel(row.away.quality)} · n={row.away.comparableSample}</div>
                      </td>
                      <td className="p-3 text-lg font-semibold">{formatNumber(row.away.adjustedAverage)}</td>
                      <td className="p-3">
                        {row.away.currentOpponent?.bucket ? `K${row.away.currentOpponent.bucket}` : "—"}
                        <div className="text-xs text-zinc-500">{marketStrengthBucketLabel(row.away.currentOpponent?.bucket ?? null)} · n={row.away.currentOpponent?.sample ?? 0}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader><CardTitle>Projekcja statystyk dom/wyjazd</CardTitle></CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/70">
                  <tr>
                    <th className="p-3">Rynek</th>
                    <th className="p-3">Gospodarz wykonuje</th>
                    <th className="p-3">Gość oddaje</th>
                    <th className="p-3">Prognoza gospodarza</th>
                    <th className="p-3">Gość wykonuje</th>
                    <th className="p-3">Gospodarz oddaje</th>
                    <th className="p-3">Prognoza gościa</th>
                    <th className="p-3">Prognoza sumy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {analysis.projections.map((row) => (
                    <tr key={row.key}>
                      <td className="p-3 font-medium">
                        {row.label}
                        <div className="text-xs text-zinc-500">
                          n składników: {row.homeForSample}/{row.awayAgainstSample} · {row.awayForSample}/{row.homeAgainstSample}
                        </div>
                      </td>
                      <td className="p-3">{formatNumber(row.homeFor)}<div className="text-xs text-zinc-500">n={row.homeForSample}</div></td>
                      <td className="p-3">{formatNumber(row.awayAgainst)}<div className="text-xs text-zinc-500">n={row.awayAgainstSample}</div></td>
                      <td className="p-3">
                        <div className={`font-semibold ${projectionQualityClass(row.homeProjectionQuality)}`}>{formatNumber(row.projectedHome)}</div>
                        <div className={`text-xs ${projectionQualityClass(row.homeProjectionQuality)}`}>{projectionQualityLabel(row.homeProjectionQuality)}</div>
                      </td>
                      <td className="p-3">{formatNumber(row.awayFor)}<div className="text-xs text-zinc-500">n={row.awayForSample}</div></td>
                      <td className="p-3">{formatNumber(row.homeAgainst)}<div className="text-xs text-zinc-500">n={row.homeAgainstSample}</div></td>
                      <td className="p-3">
                        <div className={`font-semibold ${projectionQualityClass(row.awayProjectionQuality)}`}>{formatNumber(row.projectedAway)}</div>
                        <div className={`text-xs ${projectionQualityClass(row.awayProjectionQuality)}`}>{projectionQualityLabel(row.awayProjectionQuality)}</div>
                      </td>
                      <td className="p-3 text-lg font-semibold">
                        {formatNumber(row.projectedTotal)}
                        {row.projectedTotal === null ? <div className="text-xs font-normal text-amber-600">wymaga dwóch pełnych prognoz</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BadgePercent size={18} />Warsztat rynku: fair odds i EV</CardTitle>
              <p className="text-sm text-zinc-500">
                Model empiryczny v1 dla linii połówkowych. Kursy wpisujesz ręcznie; brak jednego kursu pozwala policzyć EV, ale nie marżę i no-vig.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4">
              {workshopLineInvalid ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                  Warsztat v1 obsługuje wyłącznie linie połówkowe, np. 9,5. Podana linia nie została przeliczona.
                </div>
              ) : null}
              <Form action="/analysis" className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_0.65fr_0.65fr_0.65fr_1fr_1.5fr_auto]">
                <input type="hidden" name="seasonId" value={selectedSeason?.id ?? ""} />
                <input type="hidden" name="matchId" value={selectedMatch?.id ?? ""} />
                <input type="hidden" name="lookback" value={lookbackValue} />
                <Select name="workshopStatKey" defaultValue={workshopStatKey}>
                  {TREND_STAT_DEFINITIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </Select>
                <Select name="workshopTarget" defaultValue={workshopTarget}>
                  <option value="MATCH_TOTAL">Suma meczu</option>
                  <option value="HOME_TEAM">Suma: {selectedMatch?.homeTeam.name ?? "gospodarz"}</option>
                  <option value="AWAY_TEAM">Suma: {selectedMatch?.awayTeam.name ?? "gość"}</option>
                </Select>
                <Input name="workshopLine" type="number" min="0.5" max="499.5" step="0.5" defaultValue={workshopLine} aria-label="Linia" />
                <Input name="workshopOverOdds" type="number" min="1.01" max="1000" step="0.01" defaultValue={workshopOverOddsText} placeholder="Kurs O" />
                <Input name="workshopUnderOdds" type="number" min="1.01" max="1000" step="0.01" defaultValue={workshopUnderOddsText} placeholder="Kurs U" />
                <Input name="workshopBookmaker" maxLength={120} defaultValue={workshopBookmaker} placeholder="Bukmacher" />
                <Input name="workshopNote" maxLength={2000} defaultValue={workshopNote} placeholder="Notatka do snapshotu" />
                <Button type="submit"><Calculator size={16} className="mr-2" />Przelicz</Button>
              </Form>

              {workshop ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Zakres</div><div className="mt-1 font-semibold">{marketWorkshopTargetLabel(workshop.target, selectedMatch?.homeTeam.name, selectedMatch?.awayTeam.name)}</div></div>
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Surowa projekcja</div><div className="mt-1 text-xl font-semibold">{formatNumber(workshop.rawProjection)}</div></div>
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Skorygowana</div><div className="mt-1 text-xl font-semibold">{formatNumber(workshop.adjustedProjection)}</div></div>
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Próba i pokrycie</div><div className="mt-1 text-xl font-semibold">n={workshop.effectiveSample} · {formatNumber(workshop.coverage, 0)}%</div><div className="text-xs text-zinc-500">{marketWorkshopConfidenceLabel(workshop.confidence)}</div></div>
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Marża bukmachera</div><div className="mt-1 text-xl font-semibold">{percent(workshop.bookmakerMargin)}</div><div className="text-xs text-zinc-500">{workshop.modelVersion}</div></div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <table className="w-full min-w-[1120px] text-sm">
                      <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/70">
                        <tr><th className="p-3">Strona</th><th className="p-3">Model</th><th className="p-3">Fair odds</th><th className="p-3">Kurs</th><th className="p-3">Implied</th><th className="p-3">No-vig</th><th className="p-3">Model vs rynek</th><th className="p-3">EV</th><th className="p-3">Status</th><th className="p-3">Dziennik</th></tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {(["OVER", "UNDER"] as const).map((side) => {
                          const row = workshop.sides[side];
                          return (
                            <tr key={side}>
                              <td className="p-3 text-lg font-semibold">{side} {workshop.line}</td>
                              <td className="p-3 font-semibold">{percent(row.modelProbability)}</td>
                              <td className="p-3">{formatNumber(row.fairOdds, 2)}</td>
                              <td className="p-3">{formatNumber(row.bookmakerOdds, 2)}</td>
                              <td className="p-3">{percent(row.impliedProbability)}</td>
                              <td className="p-3">{percent(row.marketProbability)}</td>
                              <td className={`p-3 font-medium ${row.modelVsMarket !== null && row.modelVsMarket >= 0 ? "text-emerald-600" : "text-red-600"}`}>{row.modelVsMarket === null ? "—" : `${row.modelVsMarket >= 0 ? "+" : ""}${formatNumber(row.modelVsMarket, 1)} pp`}</td>
                              <td className={`p-3 text-lg font-semibold ${row.expectedValue !== null && row.expectedValue >= 0 ? "text-emerald-600" : "text-red-600"}`}>{percent(row.expectedValue)}</td>
                              <td className="p-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${workshopStatusClass(row.status)}`}>{marketWorkshopStatusLabel(row.status)}</span></td>
                              <td className="p-3">
                                {row.bookmakerOdds ? (
                                  <form action={saveMarketWorkshopPickAction}>
                                    <input type="hidden" name="returnTo" value={returnTo} />
                                    <input type="hidden" name="matchId" value={selectedMatch?.id ?? ""} />
                                    <input type="hidden" name="statKey" value={workshopStatKey} />
                                    <input type="hidden" name="target" value={workshopTarget} />
                                    <input type="hidden" name="line" value={workshopLine} />
                                    <input type="hidden" name="side" value={side} />
                                    <input type="hidden" name="lookback" value={lookbackValue} />
                                    <input type="hidden" name="overOdds" value={workshopOverOddsText} />
                                    <input type="hidden" name="underOdds" value={workshopUnderOddsText} />
                                    <input type="hidden" name="bookmaker" value={workshopBookmaker} />
                                    <input type="hidden" name="note" value={workshopNote} />
                                    <input type="hidden" name="quoteCapturedAt" value={workshopCapturedAt} />
                                    <Button type="submit" variant="secondary" size="sm"><Save size={14} className="mr-1" />Zapisz</Button>
                                  </form>
                                ) : <span className="text-xs text-zinc-500">wpisz kurs</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : <div className="text-sm text-zinc-500">Brak danych do wyliczenia warsztatu dla wybranego meczu.</div>}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Pokrycie popularnych linii over/under</CardTitle>
              <p className="text-sm text-zinc-500">Połączona próba meczów gospodarza u siebie i gościa na wyjeździe.</p>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/70">
                  <tr><th className="p-3">Rynek</th><th className="p-3">Próba</th><th className="p-3">Linie i skuteczność over</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {analysis.projections.map((row) => (
                    <tr key={row.key}>
                      <td className="p-3 font-medium">{row.label}</td>
                      <td className="p-3">{row.totalSample}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {row.lines.map((line) => (
                            <span key={line.threshold} className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-700">
                              O {line.threshold}: <strong>{rate(line.overRate)}</strong> · U: <strong>{rate(line.underRate)}</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Ostatnie H2H</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {analysis.h2h.map((item) => (
                  <Link key={item.id} href={`/matches/${item.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:border-emerald-400 dark:border-zinc-800">
                    <div><div className="font-medium">{item.homeTeam.name} – {item.awayTeam.name}</div><div className="text-xs text-zinc-500">{new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(item.kickoffAt)}</div></div>
                    <div className="text-lg font-semibold">{item.homeScore ?? "—"}:{item.awayScore ?? "—"}</div>
                  </Link>
                ))}
                {!analysis.h2h.length ? <div className="py-8 text-center text-sm text-zinc-500">Brak wcześniejszych bezpośrednich spotkań w bazie.</div> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Profil sędziego</CardTitle></CardHeader>
              <CardContent>
                {analysis.match.referee ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2"><div className="text-xl font-semibold">{analysis.match.referee.name}</div><div className="text-sm text-zinc-500">{analysis.refereeSummary.count} wcześniejszych meczów w bazie · każda średnia ma własną próbę</div></div>
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Kartki łącznie</div><div className="mt-1 text-2xl font-semibold">{formatNumber(analysis.refereeSummary.cards)}</div><div className="text-xs text-zinc-500">n={analysis.refereeSummary.cardsSample}</div></div>
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Żółte</div><div className="mt-1 text-2xl font-semibold">{formatNumber(analysis.refereeSummary.yellowCards)}</div><div className="text-xs text-zinc-500">n={analysis.refereeSummary.yellowCardsSample}</div></div>
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Czerwone</div><div className="mt-1 text-2xl font-semibold">{formatNumber(analysis.refereeSummary.redCards)}</div><div className="text-xs text-zinc-500">n={analysis.refereeSummary.redCardsSample}</div></div>
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Faule</div><div className="mt-1 text-2xl font-semibold">{formatNumber(analysis.refereeSummary.fouls)}</div><div className="text-xs text-zinc-500">n={analysis.refereeSummary.foulsSample}</div></div>
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Rożne</div><div className="mt-1 text-2xl font-semibold">{formatNumber(analysis.refereeSummary.corners)}</div><div className="text-xs text-zinc-500">n={analysis.refereeSummary.cornersSample}</div></div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-zinc-500">Źródło nie przypisało sędziego do tego meczu.</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader><CardTitle>Własne linie użytkownika</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {analysis.customLineRows.map((line) => (
                  <div key={line.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><div className="font-medium">{line.name}</div><div className="text-xs text-zinc-500">{line.statLabel} · {scopeLabels[line.scope]} · linia {line.threshold}</div></div>
                      {line.analysis.combined ? (
                        <div className="text-right"><div className="text-xs text-zinc-500">Over</div><div className="text-xl font-semibold text-emerald-600">{rate(line.analysis.combined.overRate)}</div><div className="text-xs text-zinc-500">próba {line.analysis.combined.count}</div></div>
                      ) : (
                        <div className="flex gap-5 text-right text-sm">
                          <div><div className="text-xs text-zinc-500">Gospodarz</div><div className="font-semibold text-emerald-600">{rate(line.analysis.home?.overRate)}</div><div className="text-xs text-zinc-500">n={line.analysis.home?.count ?? 0}</div></div>
                          <div><div className="text-xs text-zinc-500">Gość</div><div className="font-semibold text-emerald-600">{rate(line.analysis.away?.overRate)}</div><div className="text-xs text-zinc-500">n={line.analysis.away?.count ?? 0}</div></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {!analysis.customLineRows.length ? <div className="py-6 text-center text-sm text-zinc-500">Nie masz jeszcze aktywnych własnych linii.</div> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Dodaj własną linię</CardTitle></CardHeader>
              <CardContent>
                <form action={createCustomLineAction} className="grid gap-3">
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <Input name="name" placeholder="Np. Rożne 10.5 — analiza meczu" maxLength={80} required />
                  <Select name="statKey" defaultValue="corners">
                    {TREND_STAT_DEFINITIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                  </Select>
                  <Select name="scope" defaultValue="MATCH_TOTAL">
                    {Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                  <Input name="threshold" type="number" min="0" max="500" step="0.5" defaultValue="9.5" required />
                  <Button type="submit"><Target size={16} className="mr-2" />Zapisz linię</Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Notatka analityczna</CardTitle></CardHeader>
            <CardContent>
              <form action={saveMatchAnalysisNoteAction} className="grid gap-3">
                <input type="hidden" name="matchId" value={analysis.match.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <textarea
                  name="note"
                  rows={6}
                  maxLength={4000}
                  defaultValue={analysis.match.analysisNotes[0]?.content ?? ""}
                  placeholder="Wnioski, planowane linie, ograniczenia danych, uwagi do sędziego..."
                  aria-label="Notatka analityczna"
                  className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <div className="flex justify-end"><Button type="submit"><Save size={16} className="mr-2" />Zapisz notatkę</Button></div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
