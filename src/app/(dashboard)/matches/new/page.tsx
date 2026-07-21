import { MatchForm } from "@/components/matches/match-form";
import { createMatchAction } from "@/lib/actions/match-actions";
import { prisma } from "@/lib/db";
import { requireWriteUser } from "@/lib/auth";

export default async function NewMatchPage() {
  await requireWriteUser();
  const seasons = await prisma.season.findMany({
    where: { league: { active: true } },
    include: {
      league: { select: { name: true } },
      teams: { include: { team: { select: { id: true, name: true } } }, orderBy: { team: { name: "asc" } } },
      refereeSeasons: { include: { referee: { select: { id: true, name: true } } }, orderBy: { referee: { name: "asc" } } },
    },
    orderBy: [{ active: "desc" }, { startsAt: "desc" }],
  });

  return <div className="grid gap-5"><div><h1 className="text-2xl font-semibold">Dodaj mecz</h1><p className="text-sm text-zinc-500">Wynik i statystyki możesz uzupełnić od razu albo później.</p></div><MatchForm seasons={seasons} action={createMatchAction} /></div>;
}
