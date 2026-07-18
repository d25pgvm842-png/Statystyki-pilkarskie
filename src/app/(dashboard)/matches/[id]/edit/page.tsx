import { notFound } from "next/navigation";
import { MatchForm } from "@/components/matches/match-form";
import { updateMatchAction } from "@/lib/actions/match-actions";
import { prisma } from "@/lib/db";

export default async function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [match, seasons] = await Promise.all([
    prisma.match.findUnique({ where: { id }, include: { stats: true } }),
    prisma.season.findMany({
      where: { league: { active: true } },
      include: {
        league: { select: { name: true } },
        teams: { include: { team: { select: { id: true, name: true } } }, orderBy: { team: { name: "asc" } } },
        refereeSeasons: { include: { referee: { select: { id: true, name: true } } }, orderBy: { referee: { name: "asc" } } },
      },
      orderBy: [{ active: "desc" }, { startsAt: "desc" }],
    }),
  ]);
  if (!match) notFound();

  const stats = match.stats ? Object.fromEntries(Object.entries(match.stats).filter(([key]) => !["id", "matchId", "createdAt", "updatedAt"].includes(key)).map(([key, value]) => [key, typeof value === "number" ? value : null])) : null;
  const initial = {
    id: match.id,
    seasonId: match.seasonId,
    round: match.round,
    kickoffAt: match.kickoffAt.toISOString(),
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status: match.status,
    refereeId: match.refereeId,
    note: match.note,
    stats,
  };

  return <div className="grid gap-5"><div><h1 className="text-2xl font-semibold">Edytuj mecz</h1><p className="text-sm text-zinc-500">Każda zmiana zostanie zapisana w historii.</p></div><MatchForm seasons={seasons} action={updateMatchAction} initial={initial} /></div>;
}
