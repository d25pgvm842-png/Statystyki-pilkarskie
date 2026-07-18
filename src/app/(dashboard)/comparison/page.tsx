import Form from "next/form";
import { ArrowRightLeft, BarChart3 } from "lucide-react";
import type { MatchStats } from "@/generated/prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/db";
import { splitTeamStats } from "@/lib/stats/team-stats";
import { formatNumber } from "@/lib/utils";

function mean(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number");
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function observations(
  matches: {
    homeTeamId: string;
    stats: MatchStats | null;
  }[],
  teamId: string,
) {
  return matches
    .filter((match) => match.stats)
    .map((match) => ({
      isHome: match.homeTeamId === teamId,
      stats: match.stats ?? {},
    }));
}

export default async function ComparisonPage({
  searchParams,
}: {
  searchParams: Promise<{
    seasonId?: string;
    homeTeamId?: string;
    awayTeamId?: string;
    lookback?: string;
  }>;
}) {
  const params = await searchParams;
  const seasons = await prisma.season.findMany({
    where: { league: { active: true } },
    include: { league: true, teams: { include: { team: true }, orderBy: { team: { name: "asc" } } } },
    orderBy: [{ active: "desc" }, { startsAt: "desc" }],
  });

  const selectedSeason =
    seasons.find((season) => season.id === params.seasonId) ??
    seasons.find((season) => season.active) ??
    seasons[0];

  const teams = selectedSeason?.teams.map((membership) => membership.team) ?? [];
  const homeTeamId = teams.some((team) => team.id === params.homeTeamId) ? params.homeTeamId! : teams[0]?.id;
  const awayTeamId =
    teams.some((team) => team.id === params.awayTeamId && team.id !== homeTeamId)
      ? params.awayTeamId!
      : teams.find((team) => team.id !== homeTeamId)?.id;

  const lookback = ["5", "10", "20", "all"].includes(params.lookback ?? "") ? params.lookback! : "10";
  const take = lookback === "all" ? undefined : Number(lookback);

  const [homeTeam, awayTeam, homeMatches, awayMatches] = homeTeamId && awayTeamId && selectedSeason
    ? await Promise.all([
        prisma.team.findUnique({ where: { id: homeTeamId } }),
        prisma.team.findUnique({ where: { id: awayTeamId } }),
        prisma.match.findMany({
          where: {
            seasonId: selectedSeason.id,
            status: "FINISHED",
            OR: [{ homeTeamId }, { awayTeamId: homeTeamId }],
          },
          include: { stats: true },
          orderBy: { kickoffAt: "desc" },
          ...(take ? { take } : {}),
        }),
        prisma.match.findMany({
          where: {
            seasonId: selectedSeason.id,
            status: "FINISHED",
            OR: [{ homeTeamId: awayTeamId }, { awayTeamId }],
          },
          include: { stats: true },
          orderBy: { kickoffAt: "desc" },
          ...(take ? { take } : {}),
        }),
      ])
    : [null, null, [], []];

  const homeStats = homeTeamId ? splitTeamStats(observations(homeMatches, homeTeamId)) : null;
  const awayStats = awayTeamId ? splitTeamStats(observations(awayMatches, awayTeamId)) : null;

  const projections = homeStats && awayStats
    ? homeStats.home.map((stat, index) => {
        const awayStat = awayStats.away[index];
        const projectedHome = mean([stat.team.average, awayStat.opponent.average]);
        const projectedAway = mean([awayStat.team.average, stat.opponent.average]);
        return {
          key: stat.key,
          label: stat.label,
          homeFor: stat.team.average,
          awayAgainst: awayStat.opponent.average,
          projectedHome,
          awayFor: awayStat.team.average,
          homeAgainst: stat.opponent.average,
          projectedAway,
          projectedTotal:
            projectedHome !== null && projectedAway !== null ? projectedHome + projectedAway : null,
          homeSample: stat.team.count,
          awaySample: awayStat.team.count,
        };
      })
    : [];

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Porównanie meczu</h1>
        <p className="text-sm text-zinc-500">
          Szybka projekcja gospodarza, gościa i sumy na podstawie splitów dom/wyjazd.
        </p>
      </div>

      <Card>
        <CardContent>
          <Form action="/comparison" className="grid gap-3 md:grid-cols-4">
            <Select name="seasonId" defaultValue={selectedSeason?.id}>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>
              ))}
            </Select>
            <Select name="homeTeamId" defaultValue={homeTeamId}>
              {teams.map((team) => <option key={team.id} value={team.id}>Gospodarz: {team.name}</option>)}
            </Select>
            <Select name="awayTeamId" defaultValue={awayTeamId}>
              {teams.filter((team) => team.id !== homeTeamId).map((team) => <option key={team.id} value={team.id}>Gość: {team.name}</option>)}
            </Select>
            <Select name="lookback" defaultValue={lookback}>
              <option value="5">Ostatnie 5</option>
              <option value="10">Ostatnie 10</option>
              <option value="20">Ostatnie 20</option>
              <option value="all">Cały sezon</option>
            </Select>
            <button className="md:col-span-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">
              <ArrowRightLeft size={16} />Porównaj
            </button>
          </Form>
        </CardContent>
      </Card>

      {homeTeam && awayTeam ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-5">
              <div className="text-xs font-medium uppercase text-zinc-500">Gospodarz</div>
              <div className="mt-1 text-xl font-semibold">{homeTeam.name}</div>
              <div className="mt-1 text-sm text-zinc-500">{homeMatches.length} zakończonych meczów w próbie</div>
            </Card>
            <Card className="p-5">
              <div className="text-xs font-medium uppercase text-zinc-500">Gość</div>
              <div className="mt-1 text-xl font-semibold">{awayTeam.name}</div>
              <div className="mt-1 text-sm text-zinc-500">{awayMatches.length} zakończonych meczów w próbie</div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 size={18} className="text-emerald-600" />Projekcja statystyk</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/70">
                  <tr>
                    <th className="p-3">Rynek</th>
                    <th className="p-3">{homeTeam.name}<br /><span className="normal-case">średnia u siebie</span></th>
                    <th className="p-3">{awayTeam.name}<br /><span className="normal-case">oddaje na wyjeździe</span></th>
                    <th className="p-3">Prognoza gospodarza</th>
                    <th className="p-3">{awayTeam.name}<br /><span className="normal-case">średnia na wyjeździe</span></th>
                    <th className="p-3">{homeTeam.name}<br /><span className="normal-case">oddaje u siebie</span></th>
                    <th className="p-3">Prognoza gościa</th>
                    <th className="p-3">Prognoza sumy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {projections.map((row) => (
                    <tr key={row.key}>
                      <td className="p-3 font-medium">{row.label}<div className="text-xs text-zinc-500">próba {row.homeSample}/{row.awaySample}</div></td>
                      <td className="p-3">{formatNumber(row.homeFor)}</td>
                      <td className="p-3">{formatNumber(row.awayAgainst)}</td>
                      <td className="p-3 font-semibold text-emerald-600">{formatNumber(row.projectedHome)}</td>
                      <td className="p-3">{formatNumber(row.awayFor)}</td>
                      <td className="p-3">{formatNumber(row.homeAgainst)}</td>
                      <td className="p-3 font-semibold text-emerald-600">{formatNumber(row.projectedAway)}</td>
                      <td className="p-3 text-lg font-semibold">{formatNumber(row.projectedTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            Projekcja jest prostą średnią: produkcja drużyny oraz wartości dopuszczane przez rywala w odpowiednim splicie dom/wyjazd. To wskaźnik analityczny, nie gotowe prawdopodobieństwo zakładu.
          </div>
        </>
      ) : (
        <Card className="p-10 text-center text-zinc-500">W sezonie muszą być co najmniej dwie drużyny.</Card>
      )}
    </div>
  );
}
