import Form from "next/form";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/utils";
import { splitTeamStats } from "@/lib/stats/team-stats";

export default async function TeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ seasonId?: string }> }) {
  const { id } = await params;
  const { seasonId } = await searchParams;
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) notFound();

  const memberships = await prisma.seasonTeam.findMany({ where: { teamId: id }, include: { season: { include: { league: true } } }, orderBy: { season: { startsAt: "desc" } } });
  const selectedSeasonId = seasonId ?? memberships[0]?.seasonId;
  const matches = await prisma.match.findMany({
    where: { status: "FINISHED", ...(selectedSeasonId ? { seasonId: selectedSeasonId } : {}), OR: [{ homeTeamId: id }, { awayTeamId: id }] },
    include: { stats: true },
    orderBy: { kickoffAt: "desc" },
  });
  const observations = matches.filter((match) => match.stats).map((match) => ({ isHome: match.homeTeamId === id, stats: match.stats! }));
  const groups = splitTeamStats(observations);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">{team.name}</h1><p className="text-sm text-zinc-500">Podstawowe średnie z zakończonych meczów.</p></div><Form action={`/teams/${id}`}><Select name="seasonId" defaultValue={selectedSeasonId}>{memberships.map(({ season }) => <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>)}</Select></Form></div>
      {Object.entries(groups).map(([groupKey, stats]) => (
        <Card key={groupKey}><CardHeader><CardTitle>{groupKey === "overall" ? "Ogółem" : groupKey === "home" ? "Mecze domowe" : "Mecze wyjazdowe"}</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm"><thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/60"><tr><th className="p-3">Statystyka</th><th className="p-3">Mecze</th><th className="p-3">Drużyna</th><th className="p-3">Przeciwnik</th><th className="p-3">Łącznie</th><th className="p-3">Mediana łącznie</th><th className="p-3">Min–max łącznie</th></tr></thead><tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {stats.map((stat) => <tr key={stat.key}><td className="p-3 font-medium">{stat.label}</td><td className="p-3">{stat.total.count}</td><td className="p-3">{formatNumber(stat.team.average)}</td><td className="p-3">{formatNumber(stat.opponent.average)}</td><td className="p-3 font-semibold">{formatNumber(stat.total.average)}</td><td className="p-3">{formatNumber(stat.total.median)}</td><td className="p-3">{stat.total.min ?? "—"}–{stat.total.max ?? "—"}</td></tr>)}
          </tbody></table>
        </CardContent></Card>
      ))}
    </div>
  );
}
