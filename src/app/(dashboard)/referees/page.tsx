import Form from "next/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/utils";

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export default async function RefereesPage({ searchParams }: { searchParams: Promise<{ seasonId?: string }> }) {
  const { seasonId } = await searchParams;
  const seasons = await prisma.season.findMany({ include: { league: true }, orderBy: { startsAt: "desc" } });
  const selectedSeasonId = seasonId ?? seasons.find((season) => season.active)?.id ?? seasons[0]?.id;
  const assignments = await prisma.refereeSeason.findMany({
    where: selectedSeasonId ? { seasonId: selectedSeasonId } : {},
    include: { referee: { include: { matches: { where: selectedSeasonId ? { seasonId: selectedSeasonId, status: "FINISHED" } : { status: "FINISHED" }, include: { stats: true, homeTeam: true, awayTeam: true }, orderBy: { kickoffAt: "desc" } } } }, season: { include: { league: true } } },
    orderBy: { referee: { name: "asc" } },
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Sędziowie</h1><p className="text-sm text-zinc-500">Podstawowe średnie automatycznie liczone z przypisanych meczów.</p></div><Form action="/referees"><Select name="seasonId" defaultValue={selectedSeasonId}>{seasons.map((season) => <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>)}</Select></Form></div>
      <div className="grid gap-4 xl:grid-cols-2">
        {assignments.map(({ referee, season }) => {
          const valid = referee.matches.filter((match) => match.stats);
          const yellow = valid.map((match) => (match.stats?.homeYellowCards ?? 0) + (match.stats?.awayYellowCards ?? 0));
          const red = valid.map((match) => (match.stats?.homeRedCards ?? 0) + (match.stats?.awayRedCards ?? 0));
          const fouls = valid.map((match) => (match.stats?.homeFouls ?? 0) + (match.stats?.awayFouls ?? 0));
          return <Card key={referee.id}><CardHeader><CardTitle>{referee.name}</CardTitle><div className="text-xs text-zinc-500">{season.league.name} · {season.name}</div></CardHeader><CardContent className="grid gap-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div><div className="text-xs text-zinc-500">Mecze</div><div className="text-xl font-semibold">{valid.length}</div></div><div><div className="text-xs text-zinc-500">Żółte</div><div className="text-xl font-semibold">{formatNumber(average(yellow))}</div></div><div><div className="text-xs text-zinc-500">Czerwone</div><div className="text-xl font-semibold">{formatNumber(average(red))}</div></div><div><div className="text-xs text-zinc-500">Faule</div><div className="text-xl font-semibold">{formatNumber(average(fouls))}</div></div></div><div><div className="mb-2 text-xs font-medium uppercase text-zinc-500">Ostatnie mecze</div><div className="grid gap-2">{referee.matches.slice(0, 5).map((match) => <div key={match.id} className="flex justify-between gap-3 rounded-lg bg-zinc-50 p-2 text-sm dark:bg-zinc-950"><span>{match.homeTeam.name} – {match.awayTeam.name}</span><span>{match.stats ? `${(match.stats.homeYellowCards ?? 0) + (match.stats.awayYellowCards ?? 0)} żk` : "brak danych"}</span></div>)}{!referee.matches.length ? <span className="text-sm text-zinc-500">Brak zakończonych meczów.</span> : null}</div></div></CardContent></Card>;
        })}
      </div>
    </div>
  );
}
