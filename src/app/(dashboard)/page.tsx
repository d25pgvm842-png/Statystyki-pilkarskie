import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Database,
  FileUp,
  GitCompareArrows,
  Scale,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { findDataQualityIssues } from "@/lib/data/data-quality";
import { prisma } from "@/lib/db";

const statFields = [
  "homeCorners", "awayCorners", "homeYellowCards", "awayYellowCards",
  "homeRedCards", "awayRedCards", "homeShotsOnTarget", "awayShotsOnTarget",
  "homeShots", "awayShots", "homeFouls", "awayFouls", "homeOffsides", "awayOffsides",
] as const;

export default async function DashboardPage() {
  const [matchCount, leagueCount, seasonCount, teamCount, latestMatches, allMatches, latestImports] = await Promise.all([
    prisma.match.count(),
    prisma.league.count({ where: { active: true } }),
    prisma.season.count(),
    prisma.team.count({ where: { active: true } }),
    prisma.match.findMany({
      include: { season: { include: { league: true } }, homeTeam: true, awayTeam: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.match.findMany({
      include: { stats: true, season: { include: { league: true } }, homeTeam: true, awayTeam: true },
    }),
    prisma.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const issues = findDataQualityIssues(allMatches);
  const missingReferee = allMatches.filter((match) => match.status === "FINISHED" && !match.refereeId).length;
  const finished = allMatches.filter((match) => match.status === "FINISHED");
  const complete = finished.filter((match) =>
    match.stats && statFields.every((field) => typeof match.stats?.[field] === "number"),
  ).length;
  const completeness = finished.length ? Math.round((complete / finished.length) * 100) : 0;

  const cards = [
    { label: "Mecze", value: matchCount, icon: Database, href: "/matches" },
    { label: "Ligi", value: leagueCount, icon: Trophy, href: "/settings" },
    { label: "Sezony", value: seasonCount, icon: CalendarDays, href: "/settings" },
    { label: "Drużyny", value: teamCount, icon: Users, href: "/teams" },
    { label: "Kompletność", value: `${completeness}%`, icon: CheckCircle2, href: "/data-quality" },
    { label: "Bez sędziego", value: missingReferee, icon: Scale, href: "/data-quality" },
  ] as const;

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-500">Stan bazy, jakość danych i szybki dostęp do pracy analitycznej.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md">
              <CardContent>
                <Icon size={18} className="mb-4 text-emerald-600" />
                <div className="text-3xl font-semibold">{value}</div>
                <div className="text-sm text-zinc-500">{label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/matches/new" className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3"><Database className="text-emerald-600" /><div><div className="font-medium">Dodaj mecz ręcznie</div><div className="text-xs text-zinc-500">Pełny wynik i statystyki dom/gość</div></div></div>
        </Link>
        <Link href="/imports" className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3"><FileUp className="text-emerald-600" /><div><div className="font-medium">Importuj CSV</div><div className="text-xs text-zinc-500">Walidacja i ochrona przed duplikatami</div></div></div>
        </Link>
        <Link href="/comparison" className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3"><GitCompareArrows className="text-emerald-600" /><div><div className="font-medium">Porównaj drużyny</div><div className="text-xs text-zinc-500">Projekcja splitów dom/wyjazd</div></div></div>
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Ostatnio dodane mecze</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {latestMatches.map((match) => (
              <Link
                key={match.id}
                href={`/matches/${match.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 p-3 hover:border-emerald-400 dark:border-zinc-800"
              >
                <div>
                  <div className="font-medium">{match.homeTeam.name} – {match.awayTeam.name}</div>
                  <div className="text-xs text-zinc-500">{match.season.league.name} · {match.season.name}</div>
                </div>
                <div className="text-sm">{match.homeScore ?? "–"}:{match.awayScore ?? "–"}</div>
              </Link>
            ))}
            {!latestMatches.length ? <span className="text-sm text-zinc-500">Brak meczów.</span> : null}
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card>
            <CardHeader><CardTitle>Kontrola danych</CardTitle></CardHeader>
            <CardContent>
              {issues.length ? (
                <Link href="/data-quality" className="flex items-center gap-3 rounded-lg bg-amber-50 p-3 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertTriangle />
                  <span><strong>{issues.length}</strong> problemów wymaga sprawdzenia</span>
                </Link>
              ) : (
                <div className="flex items-center gap-2 text-sm text-emerald-600"><ShieldCheck size={18} />Brak wykrytych problemów.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ostatnie importy</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {latestImports.map((item) => (
                <Link key={item.id} href={`/imports/${item.id}`} className="rounded-lg bg-zinc-50 p-3 text-sm hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-800">
                  <div className="font-medium">{item.fileName}</div>
                  <div className="text-xs text-zinc-500">{item.status} · {item.rowsTotal} rekordów</div>
                </Link>
              ))}
              {!latestImports.length ? <Link href="/imports" className="text-sm text-emerald-600 hover:underline">Wykonaj pierwszy import CSV</Link> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
