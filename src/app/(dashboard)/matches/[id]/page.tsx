import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, Database, Download, Pencil, Scale, ShieldCheck, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { AuditEntityType } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteMatchForm } from "@/components/matches/delete-match-form";
import {
  MATCH_FIELD_LABELS,
  MATCH_STATUS_CLASSES,
  MATCH_STATUS_LABELS,
} from "@/lib/matches/presentation";
import { MATCH_TOTAL_STAT_DEFINITIONS } from "@/lib/stats/match-analytics";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function displayScore(homeScore: number | null, awayScore: number | null) {
  return homeScore === null || awayScore === null ? "– : –" : `${homeScore} : ${awayScore}`;
}

function statValue(value: number | null | undefined) {
  return typeof value === "number" ? value : "—";
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [match, auditLogs] = await Promise.all([
    prisma.match.findUnique({
      where: { id },
      include: {
        season: { include: { league: true } },
        homeTeam: true,
        awayTeam: true,
        referee: true,
        dataSource: true,
        stats: true,
        overrides: { include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.auditLog.findMany({
      where: { entityType: AuditEntityType.MATCH, entityId: id },
      include: { user: { select: { name: true } }, changes: { orderBy: { fieldName: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!match) notFound();

  const seasonIds = new Set<string>();
  const teamIds = new Set<string>();
  const refereeIds = new Set<string>();

  for (const log of auditLogs) {
    for (const change of log.changes) {
      for (const value of [change.oldValue, change.newValue]) {
        if (!value) continue;
        if (change.fieldName === "seasonId") seasonIds.add(value);
        if (change.fieldName === "homeTeamId" || change.fieldName === "awayTeamId") teamIds.add(value);
        if (change.fieldName === "refereeId") refereeIds.add(value);
      }
    }
  }

  const [seasons, teams, referees] = await Promise.all([
    seasonIds.size
      ? prisma.season.findMany({ where: { id: { in: [...seasonIds] } }, include: { league: true } })
      : [],
    teamIds.size ? prisma.team.findMany({ where: { id: { in: [...teamIds] } } }) : [],
    refereeIds.size ? prisma.referee.findMany({ where: { id: { in: [...refereeIds] } } }) : [],
  ]);

  const seasonNames = new Map(seasons.map((season) => [season.id, `${season.league.name} · ${season.name}`]));
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const refereeNames = new Map(referees.map((referee) => [referee.id, referee.name]));

  function auditValue(fieldName: string, value: string | null) {
    if (value === null || value === "null") return "brak";
    if (fieldName === "seasonId") return seasonNames.get(value) ?? value;
    if (fieldName === "homeTeamId" || fieldName === "awayTeamId") return teamNames.get(value) ?? value;
    if (fieldName === "refereeId") return refereeNames.get(value) ?? value;
    if (fieldName === "status") return MATCH_STATUS_LABELS[value] ?? value;
    if (fieldName === "kickoffAt") {
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(date);
    }
    return value;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/matches" className="mt-1 rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Wróć do meczów">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className={MATCH_STATUS_CLASSES[match.status]}>{MATCH_STATUS_LABELS[match.status]}</Badge>
              <span className="text-sm text-zinc-500">{match.season.league.name} · {match.season.name}</span>
            </div>
            <h1 className="text-2xl font-semibold">{match.homeTeam.name} – {match.awayTeam.name}</h1>
            <div className="mt-1 text-3xl font-bold tracking-tight">{displayScore(match.homeScore, match.awayScore)}</div>
          </div>
        </div>
        <Link
          href={`/matches/${match.id}/edit`}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          <Pencil size={16} className="mr-2" />Edytuj mecz
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-4"><CalendarDays size={18} className="mb-2 text-emerald-600" /><div className="text-xs text-zinc-500">Termin</div><div className="mt-1 font-medium">{new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(match.kickoffAt)}</div></Card>
        <Card className="p-4"><Clock3 size={18} className="mb-2 text-emerald-600" /><div className="text-xs text-zinc-500">Kolejka</div><div className="mt-1 font-medium">{match.round ?? "Nie podano"}</div></Card>
        <Card className="p-4"><Scale size={18} className="mb-2 text-emerald-600" /><div className="text-xs text-zinc-500">Sędzia</div><div className="mt-1 font-medium">{match.referee?.name ?? "Nie przypisano"}</div></Card>
        <Card className="p-4"><Database size={18} className="mb-2 text-emerald-600" /><div className="text-xs text-zinc-500">Źródło</div><div className="mt-1 font-medium">{match.dataSource?.name ?? "Brak"}</div></Card>
        <Card className="p-4"><ShieldCheck size={18} className="mb-2 text-emerald-600" /><div className="text-xs text-zinc-500">Ręczne korekty</div><div className="mt-1 font-medium">{match.overrides.length}</div></Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader><CardTitle>Pełne statystyki meczu</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/60">
              <tr><th className="p-3">Statystyka</th><th className="p-3">{match.homeTeam.name}</th><th className="p-3">{match.awayTeam.name}</th><th className="p-3">Łącznie</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {MATCH_TOTAL_STAT_DEFINITIONS.map((definition) => {
                const home = match.stats?.[definition.home];
                const away = match.stats?.[definition.away];
                const total = typeof home === "number" && typeof away === "number" ? home + away : null;
                return <tr key={definition.key}><td className="p-3 font-medium">{definition.label}</td><td className="p-3 text-lg font-semibold">{statValue(home)}</td><td className="p-3 text-lg font-semibold">{statValue(away)}</td><td className="p-3 text-lg font-semibold text-emerald-600">{statValue(total)}</td></tr>;
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>Informacje dodatkowe</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div><div className="text-xs uppercase text-zinc-500">Notatka</div><div className="mt-1 whitespace-pre-wrap">{match.note || "Brak notatki."}</div></div>
            <div><div className="text-xs uppercase text-zinc-500">Ostatnia aktualizacja</div><div className="mt-1">{new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(match.updatedAt)}</div></div>
            {match.sourceUpdatedAt ? <div><div className="text-xs uppercase text-zinc-500">Aktualizacja źródła</div><div className="mt-1">{new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(match.sourceUpdatedAt)}</div></div> : null}
            {match.sourceExternalId ? <div><div className="text-xs uppercase text-zinc-500">ID w źródle</div><div className="mt-1 font-mono text-xs">{match.sourceExternalId}</div></div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Historia zmian</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{log.action === "CREATE" ? "Utworzenie meczu" : "Edycja meczu"}</div>
                  <div className="text-xs text-zinc-500">{new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(log.createdAt)} · {log.user.name}</div>
                </div>
                <div className="mt-3 grid gap-2">
                  {log.changes.map((change) => (
                    <div key={change.id} className="grid gap-1 text-sm sm:grid-cols-[180px_1fr]">
                      <span className="text-zinc-500">{MATCH_FIELD_LABELS[change.fieldName] ?? change.fieldName}</span>
                      <span>{log.action === "CREATE" ? auditValue(change.fieldName, change.newValue) : <><span className="text-red-600 line-through">{auditValue(change.fieldName, change.oldValue)}</span><span className="mx-2 text-zinc-400">→</span><span className="text-emerald-600">{auditValue(change.fieldName, change.newValue)}</span></>}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!auditLogs.length ? <div className="py-8 text-center text-sm text-zinc-500">Brak zapisanej historii.</div> : null}
          </CardContent>
        </Card>
      </div>

      {user.role === "ADMIN" ? (
        <Card className="border-red-200 dark:border-red-950">
          <CardHeader><CardTitle>Strefa niebezpieczna</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-300">
              <Trash2 className="mt-0.5 shrink-0 text-red-600" size={20} />
              <p>
                Usunięcie kasuje mecz i jego statystyki. Pełny snapshot zostanie zapisany w audycie, ale przed operacją pobierz kopię danych.
              </p>
            </div>
            <a
              href="/api/admin/backup"
              className="inline-flex h-9 w-fit items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <Download size={15} className="mr-2" />Pobierz kopię przed usunięciem
            </a>
            <DeleteMatchForm matchId={match.id} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
