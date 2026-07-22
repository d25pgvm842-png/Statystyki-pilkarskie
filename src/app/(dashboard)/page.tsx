import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  FileUp,
  ListChecks,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { warsawDayBounds } from "@/lib/date-warsaw-day";
import { prisma } from "@/lib/db";
import { canWrite } from "@/lib/permissions";

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function planStatusLabel(value: string | null) {
  if (value === "APPROVED") return "zatwierdzony";
  if (value === "ARCHIVED") return "zamknięty";
  if (value === "DRAFT") return "roboczy";
  return "brak planu";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const writable = canWrite(user.role);
  const now = new Date();
  const day = warsawDayBounds(now);
  const planDate = new Date(`${day.key}T00:00:00.000Z`);

  const [todayCount, todayMatches, picks, plan, latestImport] = await Promise.all([
    prisma.match.count({
      where: { kickoffAt: { gte: day.start, lt: day.end } },
    }),
    prisma.match.findMany({
      where: { kickoffAt: { gte: day.start, lt: day.end } },
      select: {
        id: true,
        kickoffAt: true,
        status: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        season: { select: { name: true, league: { select: { name: true } } } },
      },
      orderBy: { kickoffAt: "asc" },
      take: 8,
    }),
    prisma.analysisPick.findMany({
      where: {
        userId: user.id,
        match: { kickoffAt: { gte: day.start, lt: day.end } },
      },
      select: { status: true },
    }),
    prisma.dailyPlayPlan.findUnique({
      where: { userId_planDate: { userId: user.id, planDate } },
      select: {
        id: true,
        status: true,
        items: {
          select: {
            status: true,
            analysisPick: { select: { status: true, result: true, stake: true } },
          },
        },
      },
    }),
    prisma.importBatch.findFirst({
      select: { id: true, fileName: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const displayedMatches = todayMatches.length
    ? todayMatches
    : await prisma.match.findMany({
        where: { kickoffAt: { gte: now } },
        select: {
          id: true,
          kickoffAt: true,
          status: true,
          homeScore: true,
          awayScore: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
          season: { select: { name: true, league: { select: { name: true } } } },
        },
        orderBy: { kickoffAt: "asc" },
        take: 8,
      });

  const watching = picks.filter((item) => item.status === "WATCHING").length;
  const played = picks.filter((item) => ["PLAYED", "SETTLED", "VOID"].includes(item.status)).length;
  const settled = picks.filter((item) => ["SETTLED", "VOID"].includes(item.status)).length;
  const skipped = plan?.items.filter((item) => item.status === "SKIPPED").length ?? 0;
  const planned = plan?.items.length ?? 0;

  const cards = [
    { label: "Mecze dzisiaj", value: todayCount, note: "Wszystkie ligi", icon: CalendarDays, href: "/matches" },
    { label: "Do przejrzenia", value: watching, note: "Zapisane obserwacje", icon: ListChecks, href: "/journal?status=WATCHING" },
    { label: "Zagrane", value: played, note: settled ? `${settled} już rozliczonych` : "Brak rozliczonych", icon: PlayCircle, href: "/journal?status=PLAYED" },
    { label: "Plan dnia", value: planned, note: `${planStatusLabel(plan?.status ?? null)}${skipped ? ` · ${skipped} pominięte` : ""}`, icon: CheckCircle2, href: "/play-plan" },
  ] as const;

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Dziś</h1>
        <p className="text-sm text-zinc-500">Najprostsza ścieżka: wybierz mecz, otwórz analizę, a decyzję zapisz w Dzienniku.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/matches" className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-3"><DatabaseZap className="mt-0.5 text-emerald-600" /><div><div className="font-semibold">1. Wybierz mecz</div><div className="mt-1 text-sm text-zinc-500">Znajdź spotkanie po lidze, dacie albo drużynie.</div></div></div>
        </Link>
        <Link href="/analysis" className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-3"><BarChart3 className="mt-0.5 text-emerald-600" /><div><div className="font-semibold">2. Sprawdź analizę</div><div className="mt-1 text-sm text-zinc-500">Porównaj statystyki i zobacz, czy dane są kompletne.</div></div></div>
        </Link>
        <Link href="/journal" className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-3"><BookOpen className="mt-0.5 text-emerald-600" /><div><div className="font-semibold">3. Zapisz decyzję</div><div className="mt-1 text-sm text-zinc-500">Obserwacja lub faktycznie zagrany typ. Plan gry jest opcjonalny.</div></div></div>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, note, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="h-full transition hover:border-emerald-400 hover:shadow-sm">
              <CardContent>
                <Icon size={18} className="mb-3 text-emerald-600" />
                <div className="text-3xl font-semibold">{value}</div>
                <div className="font-medium">{label}</div>
                <div className="mt-1 text-xs text-zinc-500">{note}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>{todayMatches.length ? "Dzisiejsze mecze" : "Najbliższe mecze"}</CardTitle>
                <p className="mt-1 text-sm text-zinc-500">Otwórz analizę bez przechodzenia przez dodatkowe moduły.</p>
              </div>
              <Link href="/matches" className="inline-flex items-center text-sm font-medium text-emerald-600 hover:underline">Wszystkie <ArrowRight size={14} className="ml-1" /></Link>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {displayedMatches.map((match) => (
              <div key={match.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                <div className="min-w-0">
                  <div className="font-medium">{match.homeTeam.name} – {match.awayTeam.name}</div>
                  <div className="text-xs text-zinc-500">{dateTime(match.kickoffAt)} · {match.season.league.name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/matches/${match.id}`} className="inline-flex h-9 items-center rounded-lg border border-zinc-300 px-3 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Mecz</Link>
                  <Link href={`/analysis?matchId=${match.id}`} className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700">Analiza</Link>
                </div>
              </div>
            ))}
            {!displayedMatches.length ? <div className="py-8 text-center text-sm text-zinc-500">Brak zaplanowanych meczów.</div> : null}
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card>
            <CardHeader><CardTitle>Plan gry jest opcjonalny</CardTitle></CardHeader>
            <CardContent className="text-sm text-zinc-600 dark:text-zinc-300">
              <p>Używaj go tylko wtedy, gdy chcesz porównać zamiar z faktycznie postawionym zakładem. Do zwykłej analizy wystarczą Mecze, Analiza i Dziennik.</p>
              <Link href="/play-plan" className="mt-3 inline-flex items-center font-medium text-emerald-600 hover:underline">Otwórz narzędzie zaawansowane <ArrowRight size={14} className="ml-1" /></Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Stan danych</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {latestImport ? (
                <Link href={`/imports/${latestImport.id}`} className="rounded-lg bg-zinc-50 p-3 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-800">
                  <div className="flex items-center gap-2 font-medium"><FileUp size={16} className="text-emerald-600" />{latestImport.fileName}</div>
                  <div className="mt-1 text-xs text-zinc-500">{latestImport.status} · {new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" }).format(latestImport.createdAt)}</div>
                </Link>
              ) : <div className="text-zinc-500">Brak importów.</div>}
              <Link href="/data-quality" className="inline-flex items-center font-medium text-emerald-600 hover:underline"><Clock3 size={15} className="mr-2" />Sprawdź kompletność danych</Link>
              {writable ? <Link href="/imports" className="inline-flex items-center font-medium text-emerald-600 hover:underline"><FileUp size={15} className="mr-2" />Importuj dane</Link> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
