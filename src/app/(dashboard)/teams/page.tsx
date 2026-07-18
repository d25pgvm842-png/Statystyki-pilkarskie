import Form from "next/form";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/db";

export default async function TeamsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const leagueId = typeof params.leagueId === "string" ? params.leagueId : "";
  const seasonId = typeof params.seasonId === "string" ? params.seasonId : "";
  const [leagues, seasons, memberships] = await Promise.all([
    prisma.league.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.season.findMany({ where: leagueId ? { leagueId } : {}, include: { league: true }, orderBy: { startsAt: "desc" } }),
    prisma.seasonTeam.findMany({ where: seasonId ? { seasonId } : leagueId ? { season: { leagueId } } : {}, include: { team: true, season: { include: { league: true } } }, orderBy: { team: { name: "asc" } } }),
  ]);

  const unique = new Map<string, (typeof memberships)[number]>();
  memberships.forEach((membership) => unique.set(membership.teamId, membership));

  return (
    <div className="grid gap-5">
      <div><h1 className="text-2xl font-semibold">Drużyny</h1><p className="text-sm text-zinc-500">Wybierz drużynę, aby zobaczyć średnie ogółem, u siebie i na wyjeździe.</p></div>
      <Card><CardContent><Form action="/teams" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Select name="leagueId" defaultValue={leagueId}><option value="">Wszystkie ligi</option>{leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}</Select>
        <Select name="seasonId" defaultValue={seasonId}><option value="">Wszystkie sezony</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>)}</Select>
        <div className="flex gap-2"><Button type="submit"><Search size={16} className="mr-2" />Filtruj</Button><Link href="/teams"><Button type="button" variant="secondary"><X size={16} /></Button></Link></div>
      </Form></CardContent></Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...unique.values()].map((membership) => <Link key={membership.teamId} href={`/teams/${membership.teamId}${seasonId ? `?seasonId=${seasonId}` : ""}`}><Card className="h-full transition hover:border-emerald-500"><CardContent><div className="font-semibold">{membership.team.name}</div><div className="mt-1 text-sm text-zinc-500">{membership.season.league.name} · {membership.season.name}</div></CardContent></Card></Link>)}
      </div>
    </div>
  );
}
