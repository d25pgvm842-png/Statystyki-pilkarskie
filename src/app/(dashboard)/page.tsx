import Link from "next/link";
import { AlertTriangle, CalendarDays, Database, Scale, ShieldCheck, Trophy, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { findDataQualityIssues } from "@/lib/data/data-quality";
import { prisma } from "@/lib/db";

export default async function DashboardPage() {
  const [matchCount, leagueCount, seasonCount, teamCount, latestMatches, allMatches, latestImports] = await Promise.all([
    prisma.match.count(), prisma.league.count({ where: { active: true } }), prisma.season.count(), prisma.team.count({ where: { active: true } }),
    prisma.match.findMany({ include: { season: { include: { league: true } }, homeTeam: true, awayTeam: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.match.findMany({ include: { stats: true, season: { include: { league: true } }, homeTeam: true, awayTeam: true } }),
    prisma.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const issues = findDataQualityIssues(allMatches);
  const missingReferee = allMatches.filter((match) => match.status === "FINISHED" && !match.refereeId).length;
  const cards = [
    ["Mecze", matchCount, Database], ["Ligi", leagueCount, Trophy], ["Sezony", seasonCount, CalendarDays], ["Drużyny", teamCount, Users], ["Problemy danych", issues.length, ShieldCheck], ["Bez sędziego", missingReferee, Scale],
  ] as const;

  return (
    <div className="grid gap-5">
      <div><h1 className="text-2xl font-semibold">Dashboard</h1><p className="text-sm text-zinc-500">Stan bazy i szybki dostęp do najważniejszych modułów.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{cards.map(([label, value, Icon]) => <Card key={label}><CardContent><Icon size={18} className="mb-4 text-emerald-600" /><div className="text-3xl font-semibold">{value}</div><div className="text-sm text-zinc-500">{label}</div></CardContent></Card>)}</div>
      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card><CardHeader><CardTitle>Ostatnio dodane mecze</CardTitle></CardHeader><CardContent className="grid gap-2">{latestMatches.map((match) => <Link key={match.id} href={`/matches/${match.id}/edit`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 p-3 hover:border-emerald-400 dark:border-zinc-800"><div><div className="font-medium">{match.homeTeam.name} – {match.awayTeam.name}</div><div className="text-xs text-zinc-500">{match.season.league.name} · {match.season.name}</div></div><div className="text-sm">{match.homeScore ?? "–"}:{match.awayScore ?? "–"}</div></Link>)}{!latestMatches.length ? <span className="text-sm text-zinc-500">Brak meczów.</span> : null}</CardContent></Card>
        <div className="grid gap-5">
          <Card><CardHeader><CardTitle>Kontrola danych</CardTitle></CardHeader><CardContent>{issues.length ? <Link href="/data-quality" className="flex items-center gap-3 rounded-lg bg-amber-50 p-3 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"><AlertTriangle /><span><strong>{issues.length}</strong> problemów wymaga sprawdzenia</span></Link> : <div className="text-sm text-zinc-500">Brak wykrytych problemów.</div>}</CardContent></Card>
          <Card><CardHeader><CardTitle>Ostatnie importy</CardTitle></CardHeader><CardContent className="grid gap-2">{latestImports.map((item) => <div key={item.id} className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-950"><div className="font-medium">{item.fileName}</div><div className="text-xs text-zinc-500">{item.status} · {item.rowsTotal} rekordów</div></div>)}{!latestImports.length ? <span className="text-sm text-zinc-500">Importy pojawią się w kolejnym module.</span> : null}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}
