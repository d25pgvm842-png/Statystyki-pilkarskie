import Form from "next/form";
import Link from "next/link";
import { Eye, Pencil, PlusCircle, Search, X } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { MatchStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  MATCH_STATUS_CLASSES,
  MATCH_STATUS_LABELS,
} from "@/lib/matches/presentation";
import { calculateMatchSummary } from "@/lib/stats/match-analytics";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/utils";
import { requireUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";

const validStatuses = new Set(Object.values(MatchStatus));

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function dateBoundary(value: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function MatchesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, user] = await Promise.all([searchParams, requireUser()]);
  const writable = canWrite(user.role);
  const deleted = stringParam(params.deleted) === "1";
  const leagueId = stringParam(params.leagueId);
  const seasonId = stringParam(params.seasonId);
  const teamId = stringParam(params.teamId);
  const refereeId = stringParam(params.refereeId);
  const statusParam = stringParam(params.status);
  const roundParam = stringParam(params.round);
  const dateFrom = stringParam(params.dateFrom);
  const dateTo = stringParam(params.dateTo);
  const round = /^\d+$/.test(roundParam) ? Number(roundParam) : undefined;
  const status = validStatuses.has(statusParam as MatchStatus) ? statusParam as MatchStatus : undefined;
  const from = dateBoundary(dateFrom);
  const to = dateBoundary(dateTo, true);

  const where: Prisma.MatchWhereInput = {
    ...(leagueId ? { season: { leagueId } } : {}),
    ...(seasonId ? { seasonId } : {}),
    ...(teamId ? { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] } : {}),
    ...(refereeId ? { refereeId } : {}),
    ...(status ? { status } : {}),
    ...(round ? { round } : {}),
    ...(from || to ? { kickoffAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };

  const [allMatches, leagues, seasons, teams, referees] = await Promise.all([
    prisma.match.findMany({
      where,
      include: {
        season: { include: { league: true } },
        homeTeam: true,
        awayTeam: true,
        referee: true,
        stats: true,
      },
      orderBy: { kickoffAt: "desc" },
    }),
    prisma.league.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.season.findMany({ where: leagueId ? { leagueId } : {}, include: { league: true }, orderBy: { startsAt: "desc" } }),
    prisma.team.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.referee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const matches = allMatches.slice(0, 100);
  const summary = calculateMatchSummary(allMatches);
  const metrics = new Map(summary.metrics.map((metric) => [metric.key, metric]));

  const summaryCards = [
    { label: "Mecze w filtrze", value: String(summary.matches), note: matches.length < allMatches.length ? "Tabela pokazuje 100 najnowszych" : "Wszystkie widoczne w tabeli" },
    { label: "Kompletność statystyk", value: `${formatNumber(summary.completeness, 0)}%`, note: `${summary.matchesWithStats} meczów z danymi` },
    { label: "Śr. rożnych", value: formatNumber(metrics.get("corners")?.average), note: `Próba ${metrics.get("corners")?.count ?? 0}` },
    { label: "Śr. żółtych kartek", value: formatNumber(metrics.get("yellowCards")?.average), note: `Próba ${metrics.get("yellowCards")?.count ?? 0}` },
    { label: "Śr. celnych strzałów", value: formatNumber(metrics.get("shotsOnTarget")?.average), note: `Próba ${metrics.get("shotsOnTarget")?.count ?? 0}` },
    { label: "Śr. fauli", value: formatNumber(metrics.get("fouls")?.average), note: `Próba ${metrics.get("fouls")?.count ?? 0}` },
  ];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Mecze</h1><p className="text-sm text-zinc-500">Filtry, szybkie średnie oraz pełny podgląd każdego spotkania.</p></div>
        {writable ? <Link href="/matches/new" data-requires-write className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"><PlusCircle size={16} className="mr-2" />Dodaj mecz</Link> : null}
      </div>

      {deleted ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          Mecz został usunięty, a jego pełny snapshot zapisano w audycie.
        </div>
      ) : null}

      <Card><CardContent>
        <Form action="/matches" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Select name="leagueId" defaultValue={leagueId}><option value="">Wszystkie ligi</option>{leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}</Select>
          <Select name="seasonId" defaultValue={seasonId}><option value="">Wszystkie sezony</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>)}</Select>
          <Select name="teamId" defaultValue={teamId}><option value="">Wszystkie drużyny</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select>
          <Select name="refereeId" defaultValue={refereeId}><option value="">Wszyscy sędziowie</option>{referees.map((referee) => <option key={referee.id} value={referee.id}>{referee.name}</option>)}</Select>
          <Select name="status" defaultValue={status ?? ""}><option value="">Każdy status</option>{Object.entries(MATCH_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
          <Input name="round" type="number" min="1" defaultValue={roundParam} placeholder="Kolejka" aria-label="Kolejka" />
          <Input name="dateFrom" type="date" defaultValue={dateFrom} aria-label="Data od" title="Data od" />
          <Input name="dateTo" type="date" defaultValue={dateTo} aria-label="Data do" title="Data do" />
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4 xl:col-span-8 xl:justify-end"><Button type="submit"><Search size={16} className="mr-2" />Filtruj</Button><Link href="/matches" className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"><X size={16} className="mr-2" />Wyczyść</Link></div>
        </Form>
      </CardContent></Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map((item) => <Card key={item.label} className="p-4"><div className="text-xs text-zinc-500">{item.label}</div><div className="mt-1 text-2xl font-semibold">{item.value}</div><div className="mt-1 text-xs text-zinc-500">{item.note}</div></Card>)}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/60"><tr><th className="p-3">Data</th><th className="p-3">Liga</th><th className="p-3">Mecz</th><th className="p-3">Wynik</th><th className="p-3">Status</th><th className="p-3">Sędzia</th><th className="p-3">Rożne</th><th className="p-3">Żółte</th><th className="p-3">Celne</th><th className="p-3">Faule</th><th className="p-3"></th></tr></thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {matches.map((match) => (
                <tr key={match.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="whitespace-nowrap p-3">{new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" }).format(match.kickoffAt)}</td>
                  <td className="p-3"><div className="font-medium">{match.season.league.name}</div><div className="text-xs text-zinc-500">{match.season.name}{match.round ? ` · kol. ${match.round}` : ""}</div></td>
                  <td className="p-3"><Link href={`/matches/${match.id}`} className="font-medium hover:text-emerald-600 hover:underline">{match.homeTeam.name} – {match.awayTeam.name}</Link></td>
                  <td className="p-3 font-semibold">{match.homeScore ?? "–"}:{match.awayScore ?? "–"}</td>
                  <td className="p-3"><Badge className={MATCH_STATUS_CLASSES[match.status]}>{MATCH_STATUS_LABELS[match.status]}</Badge></td>
                  <td className="p-3">{match.referee?.name ?? <span className="text-amber-600">Brak</span>}</td>
                  <td className="p-3">{match.stats?.homeCorners ?? "–"}:{match.stats?.awayCorners ?? "–"}</td>
                  <td className="p-3">{match.stats?.homeYellowCards ?? "–"}:{match.stats?.awayYellowCards ?? "–"}</td>
                  <td className="p-3">{match.stats?.homeShotsOnTarget ?? "–"}:{match.stats?.awayShotsOnTarget ?? "–"}</td>
                  <td className="p-3">{match.stats?.homeFouls ?? "–"}:{match.stats?.awayFouls ?? "–"}</td>
                  <td className="p-3"><div className="flex items-center gap-1"><Link href={`/matches/${match.id}`} className="inline-flex rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700" aria-label="Podgląd"><Eye size={16} /></Link>{writable ? <Link href={`/matches/${match.id}/edit`} data-requires-write className="inline-flex rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700" aria-label="Edytuj"><Pencil size={16} /></Link> : null}</div></td>
                </tr>
              ))}
              {!matches.length ? <tr><td colSpan={11} className="p-8 text-center text-zinc-500">Brak meczów dla wybranych filtrów.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
