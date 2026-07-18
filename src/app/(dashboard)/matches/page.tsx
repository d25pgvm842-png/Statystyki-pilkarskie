import Form from "next/form";
import Link from "next/link";
import { Pencil, PlusCircle, Search, X } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/db";

const statusLabels: Record<string, string> = {
  SCHEDULED: "Zaplanowany", LIVE: "Trwa", FINISHED: "Zakończony", POSTPONED: "Przełożony", CANCELLED: "Odwołany",
};

export default async function MatchesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const leagueId = typeof params.leagueId === "string" ? params.leagueId : "";
  const seasonId = typeof params.seasonId === "string" ? params.seasonId : "";
  const teamId = typeof params.teamId === "string" ? params.teamId : "";
  const refereeId = typeof params.refereeId === "string" ? params.refereeId : "";
  const status = typeof params.status === "string" ? params.status : "";

  const where: Prisma.MatchWhereInput = {
    ...(leagueId ? { season: { leagueId } } : {}),
    ...(seasonId ? { seasonId } : {}),
    ...(teamId ? { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] } : {}),
    ...(refereeId ? { refereeId } : {}),
    ...(status ? { status: status as Prisma.EnumMatchStatusFilter } : {}),
  };

  const [matches, leagues, seasons, teams, referees] = await Promise.all([
    prisma.match.findMany({ where, include: { season: { include: { league: true } }, homeTeam: true, awayTeam: true, referee: true, stats: true }, orderBy: { kickoffAt: "desc" }, take: 100 }),
    prisma.league.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.season.findMany({ where: leagueId ? { leagueId } : {}, include: { league: true }, orderBy: { startsAt: "desc" } }),
    prisma.team.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.referee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Mecze</h1><p className="text-sm text-zinc-500">Do 100 ostatnich rekordów zgodnych z filtrami.</p></div>
        <Link href="/matches/new"><Button><PlusCircle size={16} className="mr-2" />Dodaj mecz</Button></Link>
      </div>

      <Card><CardContent>
        <Form action="/matches" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Select name="leagueId" defaultValue={leagueId}><option value="">Wszystkie ligi</option>{leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}</Select>
          <Select name="seasonId" defaultValue={seasonId}><option value="">Wszystkie sezony</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>)}</Select>
          <Select name="teamId" defaultValue={teamId}><option value="">Wszystkie drużyny</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select>
          <Select name="refereeId" defaultValue={refereeId}><option value="">Wszyscy sędziowie</option>{referees.map((referee) => <option key={referee.id} value={referee.id}>{referee.name}</option>)}</Select>
          <Select name="status" defaultValue={status}><option value="">Każdy status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
          <div className="flex gap-2"><Button type="submit" className="flex-1"><Search size={16} className="mr-2" />Filtruj</Button><Link href="/matches"><Button type="button" variant="secondary" aria-label="Wyczyść"><X size={16} /></Button></Link></div>
        </Form>
      </CardContent></Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/60"><tr><th className="p-3">Data</th><th className="p-3">Liga</th><th className="p-3">Mecz</th><th className="p-3">Wynik</th><th className="p-3">Status</th><th className="p-3">Sędzia</th><th className="p-3">Rożne</th><th className="p-3">Kartki</th><th className="p-3"></th></tr></thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {matches.map((match) => (
                <tr key={match.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="whitespace-nowrap p-3">{new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" }).format(match.kickoffAt)}</td>
                  <td className="p-3"><div className="font-medium">{match.season.league.name}</div><div className="text-xs text-zinc-500">{match.season.name}{match.round ? ` · kol. ${match.round}` : ""}</div></td>
                  <td className="p-3 font-medium">{match.homeTeam.name} – {match.awayTeam.name}</td>
                  <td className="p-3 font-semibold">{match.homeScore ?? "–"}:{match.awayScore ?? "–"}</td>
                  <td className="p-3"><Badge>{statusLabels[match.status]}</Badge></td>
                  <td className="p-3">{match.referee?.name ?? <span className="text-amber-600">Brak</span>}</td>
                  <td className="p-3">{match.stats?.homeCorners ?? "–"}:{match.stats?.awayCorners ?? "–"}</td>
                  <td className="p-3">{match.stats?.homeYellowCards ?? "–"}:{match.stats?.awayYellowCards ?? "–"}</td>
                  <td className="p-3"><Link href={`/matches/${match.id}/edit`} className="inline-flex rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700" aria-label="Edytuj"><Pencil size={16} /></Link></td>
                </tr>
              ))}
              {!matches.length ? <tr><td colSpan={9} className="p-8 text-center text-zinc-500">Brak meczów dla wybranych filtrów.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
