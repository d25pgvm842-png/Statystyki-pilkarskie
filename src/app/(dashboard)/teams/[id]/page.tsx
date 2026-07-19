import Form from "next/form";
import Link from "next/link";
import { Search, Trophy } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/utils";
import { splitTeamStats } from "@/lib/stats/team-stats";
import { loadTeamMarketProfile } from "@/lib/data/market-ratings";
import {
  marketRatingBucketLabel,
  type MarketRatingRow,
  type RatingLookback,
} from "@/lib/stats/market-ratings";

function ratingCell(row: MarketRatingRow | null) {
  if (!row) return <span className="text-zinc-500">—</span>;
  return (
    <div>
      <div className="font-semibold">{row.rating ?? "—"}</div>
      <div className="text-xs text-zinc-500">
        śr. {formatNumber(row.average)} · n={row.sample}
      </div>
      <div className="text-xs text-zinc-500">{marketRatingBucketLabel(row.bucket)}</div>
    </div>
  );
}

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ seasonId?: string; lookback?: string }>;
}) {
  const { id } = await params;
  const { seasonId, lookback: lookbackParam } = await searchParams;
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) notFound();

  const memberships = await prisma.seasonTeam.findMany({
    where: { teamId: id },
    include: { season: { include: { league: true } } },
    orderBy: { season: { startsAt: "desc" } },
  });
  const selectedSeasonId = memberships.some((membership) => membership.seasonId === seasonId)
    ? seasonId
    : memberships[0]?.seasonId;
  const lookback = ["5", "10", "20", "all"].includes(lookbackParam ?? "") ? lookbackParam! : "10";
  const take = lookback === "all" ? undefined : Number(lookback);
  const ratingLookback: RatingLookback = lookback === "all"
    ? null
    : Number(lookback) as 5 | 10 | 20;

  const [matches, ratingProfile] = await Promise.all([
    prisma.match.findMany({
      where: {
        status: "FINISHED",
        ...(selectedSeasonId ? { seasonId: selectedSeasonId } : {}),
        OR: [{ homeTeamId: id }, { awayTeamId: id }],
      },
      include: { stats: true, homeTeam: true, awayTeam: true },
      orderBy: { kickoffAt: "desc" },
      ...(take ? { take } : {}),
    }),
    selectedSeasonId
      ? loadTeamMarketProfile({
          seasonId: selectedSeasonId,
          teamId: id,
          lookback: ratingLookback,
          minSample: 3,
        })
      : Promise.resolve([]),
  ]);

  const observations = matches
    .filter((match) => match.stats)
    .map((match) => ({ isHome: match.homeTeamId === id, stats: match.stats! }));
  const groups = splitTeamStats(observations);
  const homeMatches = matches.filter((match) => match.homeTeamId === id).length;
  const awayMatches = matches.length - homeMatches;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">{team.name}</h1><p className="text-sm text-zinc-500">Średnie ogółem, u siebie i na wyjeździe z wybranego zakresu.</p></div>
        <Form action={`/teams/${id}`} className="flex flex-wrap gap-2">
          <Select name="seasonId" defaultValue={selectedSeasonId}>{memberships.map(({ season }) => <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>)}</Select>
          <Select name="lookback" defaultValue={lookback}><option value="5">Ostatnie 5</option><option value="10">Ostatnie 10</option><option value="20">Ostatnie 20</option><option value="all">Cały sezon</option></Select>
          <Button type="submit"><Search size={16} className="mr-2" />Pokaż</Button>
        </Form>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-zinc-500">Mecze w próbie</div><div className="mt-1 text-3xl font-semibold">{matches.length}</div><div className="text-xs text-zinc-500">{lookback === "all" ? "cały sezon" : `ostatnie ${lookback}`}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">U siebie</div><div className="mt-1 text-3xl font-semibold">{homeMatches}</div><div className="text-xs text-zinc-500">meczów w wybranej próbie</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Na wyjeździe</div><div className="mt-1 text-3xl font-semibold">{awayMatches}</div><div className="text-xs text-zinc-500">meczów w wybranej próbie</div></Card>
      </div>

      {ratingProfile.length ? (
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Trophy size={18} />Ratingi rynkowe na tle ligi</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">Rating 0–100 oznacza pozycję percentylową. Minimum do ratingu: 3 obserwacje.</p>
            </div>
            <Link
              href={`/ratings?seasonId=${selectedSeasonId}&lookback=${lookback}&minSample=3`}
              className="text-sm font-medium text-emerald-600 hover:underline"
            >
              Otwórz pełne rankingi
            </Link>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/60">
                <tr>
                  <th className="p-3">Rynek</th>
                  <th className="p-3">Wykonuje</th>
                  <th className="p-3">Oddaje rywalom</th>
                  <th className="p-3">Suma w meczu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {ratingProfile.map((row) => (
                  <tr key={row.statKey}>
                    <td className="p-3 font-medium">
                      <Link
                        href={`/ratings?seasonId=${selectedSeasonId}&statKey=${row.statKey}&scope=TEAM_FOR&venue=ALL&lookback=${lookback}&minSample=3`}
                        className="hover:text-emerald-600"
                      >
                        {row.label}
                      </Link>
                    </td>
                    <td className="p-3">{ratingCell(row.for)}</td>
                    <td className="p-3">{ratingCell(row.against)}</td>
                    <td className="p-3">{ratingCell(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {Object.entries(groups).map(([groupKey, stats]) => (
        <Card key={groupKey}>
          <CardHeader><CardTitle>{groupKey === "overall" ? "Ogółem" : groupKey === "home" ? "Mecze domowe" : "Mecze wyjazdowe"}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/60"><tr><th className="p-3">Statystyka</th><th className="p-3">Mecze</th><th className="p-3">Drużyna</th><th className="p-3">Przeciwnik</th><th className="p-3">Łącznie</th><th className="p-3">Mediana łącznie</th><th className="p-3">Min–max łącznie</th></tr></thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {stats.map((stat) => <tr key={stat.key}><td className="p-3 font-medium">{stat.label}</td><td className="p-3">{stat.total.count}</td><td className="p-3">{formatNumber(stat.team.average)}</td><td className="p-3">{formatNumber(stat.opponent.average)}</td><td className="p-3 font-semibold">{formatNumber(stat.total.average)}</td><td className="p-3">{formatNumber(stat.total.median)}</td><td className="p-3">{stat.total.min ?? "—"}–{stat.total.max ?? "—"}</td></tr>)}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader><CardTitle>Ostatnie mecze w próbie</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {matches.map((match) => {
            const isHome = match.homeTeamId === id;
            const teamScore = isHome ? match.homeScore : match.awayScore;
            const opponentScore = isHome ? match.awayScore : match.homeScore;
            const opponent = isHome ? match.awayTeam.name : match.homeTeam.name;
            return (
              <Link key={match.id} href={`/matches/${match.id}`} className="grid gap-2 rounded-lg border border-zinc-200 p-3 text-sm transition hover:border-emerald-400 sm:grid-cols-[120px_1fr_auto] dark:border-zinc-800">
                <span className="text-zinc-500">{new Intl.DateTimeFormat("pl-PL", { dateStyle: "short" }).format(match.kickoffAt)}</span>
                <span><span className="font-medium">{isHome ? "DOM" : "WYJ"}</span> · {opponent}</span>
                <span className="font-semibold">{teamScore ?? "–"}:{opponentScore ?? "–"}</span>
              </Link>
            );
          })}
          {!matches.length ? <div className="py-8 text-center text-sm text-zinc-500">Brak zakończonych meczów w wybranym zakresie.</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
