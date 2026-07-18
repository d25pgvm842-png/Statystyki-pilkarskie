import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { calculateRefereeSummary } from "@/lib/stats/match-analytics";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/utils";

export default async function RefereesPage({ searchParams }: { searchParams: Promise<{ seasonId?: string; lookback?: string }> }) {
  const { seasonId, lookback: lookbackParam } = await searchParams;
  const seasons = await prisma.season.findMany({ include: { league: true }, orderBy: [{ active: "desc" }, { startsAt: "desc" }] });
  const selectedSeasonId = seasons.some((season) => season.id === seasonId)
    ? seasonId
    : seasons.find((season) => season.active)?.id ?? seasons[0]?.id;
  const lookback = ["5", "10", "20", "all"].includes(lookbackParam ?? "") ? lookbackParam! : "10";
  const take = lookback === "all" ? undefined : Number(lookback);

  const assignments = await prisma.refereeSeason.findMany({
    where: selectedSeasonId ? { seasonId: selectedSeasonId } : {},
    include: {
      referee: {
        include: {
          matches: {
            where: selectedSeasonId ? { seasonId: selectedSeasonId, status: "FINISHED" } : { status: "FINISHED" },
            include: { stats: true, homeTeam: true, awayTeam: true },
            orderBy: { kickoffAt: "desc" },
            ...(take ? { take } : {}),
          },
        },
      },
      season: { include: { league: true } },
    },
    orderBy: { referee: { name: "asc" } },
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Sędziowie</h1><p className="text-sm text-zinc-500">Średnie meczowe, linie kartek i ostatnie spotkania.</p></div>
        <Form action="/referees" className="flex flex-wrap gap-2">
          <Select name="seasonId" defaultValue={selectedSeasonId}>{seasons.map((season) => <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>)}</Select>
          <Select name="lookback" defaultValue={lookback}><option value="5">Ostatnie 5</option><option value="10">Ostatnie 10</option><option value="20">Ostatnie 20</option><option value="all">Cały sezon</option></Select>
          <Button type="submit"><Search size={16} className="mr-2" />Pokaż</Button>
        </Form>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {assignments.map(({ referee, season }) => {
          const summary = calculateRefereeSummary(referee.matches);
          const metricMap = new Map(summary.metrics.map((metric) => [metric.key, metric]));
          return (
            <Card key={referee.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div><CardTitle>{referee.name}</CardTitle><div className="mt-1 text-xs text-zinc-500">{season.league.name} · {season.name} · {lookback === "all" ? "cały sezon" : `ostatnie ${lookback}`}</div></div>
                  <div className="rounded-lg bg-zinc-100 px-3 py-2 text-center dark:bg-zinc-800"><div className="text-xl font-semibold">{summary.matches}</div><div className="text-[10px] uppercase text-zinc-500">meczów</div></div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <div><div className="text-xs text-zinc-500">Żółte</div><div className="text-xl font-semibold">{formatNumber(metricMap.get("yellowCards")?.average)}</div></div>
                  <div><div className="text-xs text-zinc-500">Czerwone</div><div className="text-xl font-semibold">{formatNumber(metricMap.get("redCards")?.average)}</div></div>
                  <div><div className="text-xs text-zinc-500">Faule</div><div className="text-xl font-semibold">{formatNumber(metricMap.get("fouls")?.average)}</div></div>
                  <div><div className="text-xs text-zinc-500">Rożne</div><div className="text-xl font-semibold">{formatNumber(metricMap.get("corners")?.average)}</div></div>
                  <div><div className="text-xs text-zinc-500">Strzały</div><div className="text-xl font-semibold">{formatNumber(metricMap.get("shots")?.average)}</div></div>
                  <div><div className="text-xs text-zinc-500">Kompletność</div><div className="text-xl font-semibold">{formatNumber(summary.completeness, 0)}%</div></div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium uppercase text-zinc-500">Pokrycie linii żółtych kartek</div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {summary.yellowCardLines.map((line) => (
                      <div key={line.threshold} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                        <div className="text-xs text-zinc-500">Over {line.threshold}</div>
                        <div className="mt-1 text-2xl font-semibold text-emerald-600">{line.hitRate === null ? "—" : `${formatNumber(line.hitRate, 0)}%`}</div>
                        <div className="text-xs text-zinc-500">próba {line.count}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium uppercase text-zinc-500">Ostatnie mecze</div>
                  <div className="grid gap-2">
                    {referee.matches.slice(0, 5).map((match) => (
                      <Link key={match.id} href={`/matches/${match.id}`} className="flex flex-wrap justify-between gap-3 rounded-lg bg-zinc-50 p-3 text-sm transition hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-800">
                        <span>{match.homeTeam.name} – {match.awayTeam.name}</span>
                        <span className="font-medium">{match.stats ? `${(match.stats.homeYellowCards ?? 0) + (match.stats.awayYellowCards ?? 0)} żk · ${(match.stats.homeFouls ?? 0) + (match.stats.awayFouls ?? 0)} fauli` : "brak danych"}</span>
                      </Link>
                    ))}
                    {!referee.matches.length ? <span className="text-sm text-zinc-500">Brak zakończonych meczów.</span> : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!assignments.length ? <Card className="p-10 text-center text-zinc-500 xl:col-span-2">Brak sędziów przypisanych do wybranego sezonu.</Card> : null}
      </div>
    </div>
  );
}
