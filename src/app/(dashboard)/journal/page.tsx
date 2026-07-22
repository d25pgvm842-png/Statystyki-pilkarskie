import Form from "next/form";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Calculator,
  Download,
  ExternalLink,
  PlusCircle,
  RefreshCw,
  Save,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  addAnalysisPickAction,
  settleAnalysisPickManuallyAction,
  settleFinishedAnalysisPicksAction,
  updateAnalysisPickAction,
} from "@/lib/actions/analysis-journal-actions";
import { requireUser } from "@/lib/auth";
import { loadAnalysisJournal } from "@/lib/data/analysis-journal";
import { prisma } from "@/lib/db";
import {
  selectionClv,
  selectionProfit,
  type JournalAnalyticsRow,
} from "@/lib/stats/analysis-journal";
import { marketWorkshopStatusLabel, type MarketWorkshopStatus } from "@/lib/stats/market-workshop";
import { TREND_STAT_DEFINITIONS } from "@/lib/stats/trends";
import { formatNumber } from "@/lib/utils";
import { PagePurpose } from "@/components/layout/page-purpose";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  WATCHING: "Obserwowana",
  PLAYED: "Zagrana",
  REJECTED: "Odrzucona",
  SETTLED: "Rozliczona",
  VOID: "Void",
};

const resultLabels: Record<string, string> = {
  WIN: "Trafiona",
  LOSS: "Nietrafiona",
  PUSH: "Push",
  VOID: "Void",
};

const sourceLabels: Record<string, string> = {
  SCANNER: "Skaner",
  MANUAL: "Ręczne",
};

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function dateTextParam(value: string | string[] | undefined) {
  const text = stringParam(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? "" : text;
}

function utcDate(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function nextUtcDay(value: string) {
  const date = utcDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${formatNumber(value, 1)}%`;
}

function currency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(value);
}

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function statusClass(value: string) {
  if (value === "SETTLED") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (value === "PLAYED") return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (value === "REJECTED" || value === "VOID") return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
}

function resultClass(value: string | null) {
  if (value === "WIN") return "text-emerald-600";
  if (value === "LOSS") return "text-red-600";
  return "text-zinc-500";
}

function AnalyticsTable({
  title,
  rows,
}: {
  title: string;
  rows: JournalAnalyticsRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-emerald-600" />
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                <tr>
                  <th className="p-3">Segment</th>
                  <th className="p-3">Pozycje</th>
                  <th className="p-3">Rozliczone</th>
                  <th className="p-3">Bilans</th>
                  <th className="p-3">Hit rate</th>
                  <th className="p-3">Obrót</th>
                  <th className="p-3">Wynik</th>
                  <th className="p-3">ROI</th>
                  <th className="p-3">Śr. kurs</th>
                  <th className="p-3">Śr. CLV</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="p-3 font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{row.label}</span>
                        {row.smallSample ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <AlertTriangle size={11} className="mr-1" />mała próba
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3">{row.totalEntries}</td>
                    <td className="p-3">{row.settled}</td>
                    <td className="p-3">{row.wins}T · {row.losses}N · {row.pushes}P</td>
                    <td className="p-3 font-medium">{percent(row.hitRate)}</td>
                    <td className="p-3">{row.financialEntries ? currency(row.turnover) : "—"}</td>
                    <td className={`p-3 font-medium ${row.financialEntries ? (row.profit >= 0 ? "text-emerald-600" : "text-red-600") : "text-zinc-500"}`}>
                      {row.financialEntries ? currency(row.profit) : "—"}
                    </td>
                    <td className="p-3 font-medium">{row.financialEntries ? percent(row.roi) : "—"}</td>
                    <td className="p-3">{row.averageOdds === null ? "—" : formatNumber(row.averageOdds, 2)}</td>
                    <td className="p-3">{percent(row.averageClv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-zinc-500">Brak danych dla wybranych filtrów.</div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const statusParam = stringParam(params.status);
  const status = ["WATCHING", "PLAYED", "REJECTED", "SETTLED", "VOID"].includes(statusParam)
    ? statusParam
    : null;
  const statParam = stringParam(params.statKey);
  const statKey = TREND_STAT_DEFINITIONS.some((item) => item.key === statParam)
    ? statParam
    : null;
  const seasonId = stringParam(params.seasonId) || null;
  const leagueId = stringParam(params.leagueId) || null;
  const sourceParam = stringParam(params.source);
  const source = ["SCANNER", "MANUAL"].includes(sourceParam) ? sourceParam : null;
  const fromText = dateTextParam(params.from);
  const toText = dateTextParam(params.to);
  const from = utcDate(fromText);
  const to = nextUtcDay(toText);
  const fullHistory = stringParam(params.range) === "all";

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setUTCHours(0, 0, 0, 0);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 90);
  const defaultRangeActive = !fromText && !toText && !fullHistory;
  const displayFromText = fromText || (defaultRangeActive ? defaultFrom.toISOString().slice(0, 10) : "");
  const effectiveFrom = from ?? (defaultRangeActive ? defaultFrom : null);
  const future = new Date(now);
  future.setUTCDate(future.getUTCDate() + 90);

  const [journal, seasons, leagues, upcomingMatches] = await Promise.all([
    loadAnalysisJournal({
      userId: user.id,
      seasonId,
      leagueId,
      status,
      statKey,
      source,
      from: effectiveFrom,
      to,
    }),
    prisma.season.findMany({
      where: { league: { active: true } },
      include: { league: true },
      orderBy: [{ startsAt: "desc" }, { league: { name: "asc" } }],
    }),
    prisma.league.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.match.findMany({
      where: {
        status: "SCHEDULED",
        kickoffAt: { gte: now, lte: future },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        season: { include: { league: true } },
      },
      orderBy: { kickoffAt: "asc" },
      take: 300,
    }),
  ]);

  const query = new URLSearchParams();
  if (seasonId) query.set("seasonId", seasonId);
  if (leagueId) query.set("leagueId", leagueId);
  if (status) query.set("status", status);
  if (statKey) query.set("statKey", statKey);
  if (source) query.set("source", source);
  if (displayFromText) query.set("from", displayFromText);
  if (toText) query.set("to", toText);
  if (fullHistory) query.set("range", "all");
  const returnTo = `/journal${query.size ? `?${query.toString()}` : ""}`;
  const allHistoryQuery = new URLSearchParams(query);
  allHistoryQuery.delete("from");
  allHistoryQuery.delete("to");
  allHistoryQuery.set("range", "all");
  const analyticsQuery = new URLSearchParams(query);
  analyticsQuery.set("mode", "analytics");
  const { items, metrics, analytics } = journal;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="text-emerald-600" size={24} />
            <h1 className="text-2xl font-semibold">Dziennik decyzji</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Watchlista kandydatów, zapis decyzji, kursów, stawek oraz późniejsze rozliczenie.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="#dodaj-recznie"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <PlusCircle size={16} className="mr-2" />Dodaj ręcznie
          </Link>
          <form action={settleFinishedAnalysisPicksAction}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <Button type="submit" variant="secondary">
              <RefreshCw size={16} className="mr-2" />Rozlicz zakończone
            </Button>
          </form>
          <Link
            href={`/journal/calibration${query.size ? `?${query.toString()}` : ""}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-blue-300 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-zinc-900 dark:text-blue-300 dark:hover:bg-blue-950/30"
          >
            <TrendingUp size={16} className="mr-2" />Kalibracja modelu
          </Link>
          <Link
            href={`/journal/export?${analyticsQuery.toString()}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-emerald-300 bg-white px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
          >
            <BarChart3 size={16} className="mr-2" />Eksport analityki
          </Link>
          <Link
            href={`/journal/export${query.size ? `?${query.toString()}` : ""}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <Download size={16} className="mr-2" />Pełny CSV
          </Link>
        </div>
      </div>

      <PagePurpose nextHref="/matches" nextLabel="Wybierz mecz">
        Dziennik służy do zapisania tego, co obserwujesz albo faktycznie zagrałeś. Plan gry, strategie i CLV są dodatkami — nie musisz ich używać w codziennej pracy.
      </PagePurpose>

      {defaultRangeActive ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span>Ze względu na szybkość domyślnie pokazujemy ostatnie 90 dni.</span>
          <Link href={`/journal?${allHistoryQuery.toString()}`} className="font-medium text-emerald-600 hover:underline">Pokaż całą historię</Link>
        </div>
      ) : null}

      {stringParam(params.saved) ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          Pozycja została dodana do dziennika.
        </div>
      ) : null}
      {stringParam(params.already) ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Taki sam mecz, rynek, linia i kierunek już znajdują się w dzienniku.
        </div>
      ) : null}
      {stringParam(params.settled) ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
          Rozliczone pozycje: {stringParam(params.settled)}.
        </div>
      ) : null}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
        Dziennik zapisuje decyzję i wynik. Nie ocenia legalności ani zasadności zakładu. ROI jest liczone wyłącznie dla pozycji mających stawkę i możliwy do obliczenia wynik finansowy.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Card className="p-4">
          <Target size={18} className="mb-2 text-amber-600" />
          <div className="text-xs text-zinc-500">Obserwowane</div>
          <div className="mt-1 text-3xl font-semibold">{metrics.watching}</div>
        </Card>
        <Card className="p-4">
          <WalletCards size={18} className="mb-2 text-blue-600" />
          <div className="text-xs text-zinc-500">Zagrane otwarte</div>
          <div className="mt-1 text-3xl font-semibold">{metrics.playedOpen}</div>
        </Card>
        <Card className="p-4">
          <TrendingUp size={18} className="mb-2 text-emerald-600" />
          <div className="text-xs text-zinc-500">Trafność</div>
          <div className="mt-1 text-3xl font-semibold">{percent(metrics.hitRate)}</div>
          <div className="text-xs text-zinc-500">{metrics.wins}T · {metrics.losses}N · {metrics.pushes}P</div>
        </Card>
        <Card className="p-4">
          <Calculator size={18} className="mb-2 text-emerald-600" />
          <div className="text-xs text-zinc-500">Obrót</div>
          <div className="mt-1 text-2xl font-semibold">{metrics.financialEntries ? currency(metrics.turnover) : "—"}</div>
        </Card>
        <Card className="p-4">
          <WalletCards size={18} className="mb-2 text-emerald-600" />
          <div className="text-xs text-zinc-500">Wynik</div>
          <div className={`mt-1 text-2xl font-semibold ${metrics.financialEntries ? (metrics.profit >= 0 ? "text-emerald-600" : "text-red-600") : "text-zinc-500"}`}>
            {metrics.financialEntries ? currency(metrics.profit) : "—"}
          </div>
          <div className="text-xs text-zinc-500">ROI {percent(metrics.roi)}</div>
        </Card>
        <Card className="p-4">
          <TrendingUp size={18} className="mb-2 text-emerald-600" />
          <div className="text-xs text-zinc-500">Średnie CLV</div>
          <div className="mt-1 text-3xl font-semibold">{percent(metrics.averageClv)}</div>
          <div className="text-xs text-zinc-500">kurs zapisany vs zamknięcia</div>
        </Card>
      </div>

      <Card id="dodaj-recznie" className="scroll-mt-5">
        <CardHeader>
          <CardTitle>Dodaj ręcznie</CardTitle>
          <p className="text-sm text-zinc-500">Dla sumy wybranego rynku w zaplanowanym meczu.</p>
        </CardHeader>
        <CardContent>
          <form action={addAnalysisPickAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_0.7fr_0.7fr_1.6fr_auto]">
            <input type="hidden" name="source" value="MANUAL" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <Select name="matchId" required defaultValue="">
              <option value="" disabled>Wybierz mecz</option>
              {upcomingMatches.map((match) => (
                <option key={match.id} value={match.id}>
                  {dateTime(match.kickoffAt)} · {match.season.league.code} · {match.homeTeam.name} – {match.awayTeam.name}
                </option>
              ))}
            </Select>
            <Select name="statKey" defaultValue="corners">
              {TREND_STAT_DEFINITIONS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </Select>
            <Input name="threshold" type="number" min="0" max="500" step="0.5" required placeholder="Linia" />
            <Select name="side" defaultValue="OVER">
              <option value="OVER">OVER</option>
              <option value="UNDER">UNDER</option>
            </Select>
            <Input name="note" maxLength={2000} placeholder="Krótka notatka, opcjonalnie" />
            <Button type="submit"><PlusCircle size={16} className="mr-2" />Dodaj</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtry Dziennika i analityki</CardTitle>
        </CardHeader>
        <CardContent>
          <Form action="/journal" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Select name="leagueId" defaultValue={leagueId ?? ""}>
              <option value="">Wszystkie ligi</option>
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>{league.name}</option>
              ))}
            </Select>
            <Select name="seasonId" defaultValue={seasonId ?? ""}>
              <option value="">Wszystkie sezony</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>
              ))}
            </Select>
            <Select name="statKey" defaultValue={statKey ?? ""}>
              <option value="">Wszystkie rynki</option>
              {TREND_STAT_DEFINITIONS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </Select>
            <Select name="source" defaultValue={source ?? ""}>
              <option value="">Wszystkie źródła</option>
              {Object.entries(sourceLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Select name="status" defaultValue={status ?? ""}>
              <option value="">Wszystkie statusy</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Input name="from" type="date" defaultValue={displayFromText} aria-label="Data od" />
            <Input name="to" type="date" defaultValue={toText} aria-label="Data do" />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Filtruj</Button>
              <Link href="/journal" className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                Wyczyść
              </Link>
            </div>
          </Form>
        </CardContent>
      </Card>

      <section className="grid gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="text-emerald-600" size={22} />
            <h2 className="text-xl font-semibold">Analityka Dziennika</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Segmenty korzystają z tych samych filtrów co lista. Mała próba oznacza mniej niż 10 rozliczonych pozycji.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <AnalyticsTable title="Według ligi" rows={analytics.byLeague} />
          <AnalyticsTable title="Według rynku" rows={analytics.byMarket} />
          <AnalyticsTable title="OVER / UNDER" rows={analytics.bySide} />
          <AnalyticsTable title="Według źródła" rows={analytics.bySource} />
          <div className="xl:col-span-2">
            <AnalyticsTable title="Według statusu historycznego" rows={analytics.byEvidence} />
          </div>
        </div>
      </section>

      <div className="grid gap-4">
        {items.map((item) => {
          const profit = selectionProfit({
            result: item.result,
            odds: item.odds,
            stake: item.stake,
          });
          const clv = selectionClv({
            odds: item.odds,
            closingOdds: item.closingOdds,
          });
          const selectedTeamName = item.selectedTeamId === item.match.homeTeam.id
            ? item.match.homeTeam.name
            : item.selectedTeamId === item.match.awayTeam.id
              ? item.match.awayTeam.name
              : null;
          return (
            <Card key={item.id}>
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-zinc-500">
                      {item.match.season.league.name} · {item.match.season.name} · {dateTime(item.match.kickoffAt)}
                    </div>
                    <CardTitle className="mt-1">{item.match.homeTeam.name} – {item.match.awayTeam.name}</CardTitle>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">{item.statLabel}</span>
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold dark:bg-zinc-800">{item.side} {item.threshold}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(item.status)}`}>{statusLabels[item.status] ?? item.status}</span>
                      {item.decisionTiming === "LATE" ? <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">LATE · po kickoffie</span> : null}
                      {item.decisionTiming === "UNKNOWN" ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">Nieznany czas decyzji</span> : null}
                      {item.result ? <span className={`rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold dark:bg-zinc-800 ${resultClass(item.result)}`}>{resultLabels[item.result] ?? item.result}</span> : null}
                    </div>
                  </div>
                  <Link href={`/analysis?matchId=${item.matchId}`} className="inline-flex items-center text-sm font-medium text-emerald-600 hover:underline">
                    Pełna analiza <ExternalLink size={14} className="ml-1" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Projekcja</div><div className="mt-1 text-xl font-semibold">{formatNumber(item.projection)}</div></div>
                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Przewaga</div><div className="mt-1 text-xl font-semibold">{formatNumber(item.edge)}</div></div>
                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Próba H/A</div><div className="mt-1 text-xl font-semibold">{item.homeSample ?? "—"}/{item.awaySample ?? "—"}</div></div>
                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Backtest kierunku</div><div className="mt-1 text-xl font-semibold">{percent(item.backtestHitRate)}</div><div className="text-xs text-zinc-500">n={item.backtestSignals ?? "—"}</div></div>
                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Wynik finansowy</div><div className={`mt-1 text-xl font-semibold ${profit !== null && profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{currency(profit)}</div></div>
                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">CLV</div><div className="mt-1 text-xl font-semibold">{percent(clv)}</div></div>
                </div>

                {item.modelVersion ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">Snapshot warsztatu rynku</div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium dark:bg-zinc-900">{item.modelVersion}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                      <div><div className="text-xs text-zinc-500">Model</div><div className="font-semibold">{percent(item.modelProbability)}</div></div>
                      <div><div className="text-xs text-zinc-500">Fair odds</div><div className="font-semibold">{formatNumber(item.fairOdds, 2)}</div></div>
                      <div><div className="text-xs text-zinc-500">Rynek no-vig</div><div className="font-semibold">{percent(item.marketProbability)}</div></div>
                      <div><div className="text-xs text-zinc-500">EV</div><div className={`font-semibold ${item.expectedValue !== null && item.expectedValue >= 0 ? "text-emerald-600" : "text-red-600"}`}>{percent(item.expectedValue)}</div></div>
                      <div><div className="text-xs text-zinc-500">Próba / pokrycie</div><div className="font-semibold">n={item.modelSample ?? "—"} · {percent(item.modelCoverage)}</div></div>
                      <div><div className="text-xs text-zinc-500">Status</div><div className="font-semibold">{item.marketStatus ? marketWorkshopStatusLabel(item.marketStatus as MarketWorkshopStatus) : "—"}</div></div>
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      {selectedTeamName ? `Drużyna: ${selectedTeamName} · ` : ""}kurs przeciwny {formatNumber(item.oppositeOdds, 2)} · marża {percent(item.bookmakerMargin)} · wiarygodność {item.modelConfidence ?? "—"} · pobrano {item.quoteCapturedAt ? dateTime(item.quoteCapturedAt) : "—"}
                    </div>
                  </div>
                ) : null}

                <form action={updateAnalysisPickAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[0.9fr_1fr_0.7fr_0.7fr_0.7fr_2fr_auto]">
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <Select name="status" defaultValue={item.status}>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                  <Input name="bookmaker" maxLength={120} defaultValue={item.bookmaker ?? ""} placeholder="Bukmacher" />
                  <Input name="odds" type="number" min="1.01" max="1000" step="0.01" defaultValue={item.odds ?? ""} placeholder="Kurs" />
                  <Input name="closingOdds" type="number" min="1.01" max="1000" step="0.01" defaultValue={item.closingOdds ?? ""} placeholder="Kurs zamk." />
                  <Input name="stake" type="number" min="0.01" max="10000000" step="0.01" defaultValue={item.stake ?? ""} placeholder="Stawka PLN" />
                  <Input name="note" maxLength={2000} defaultValue={item.note ?? ""} placeholder="Uzasadnienie lub komentarz" />
                  <Button type="submit" variant="secondary"><Save size={16} className="mr-2" />Zapisz</Button>
                </form>

                {(item.status === "PLAYED" || item.status === "SETTLED") ? (
                  <form action={settleAnalysisPickManuallyAction} className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <div>
                      <div className="mb-1 text-xs text-zinc-500">Wartość rzeczywista</div>
                      <Input name="actualValue" type="number" min="0" max="500" step="1" defaultValue={item.actualValue ?? ""} className="w-36" />
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-zinc-500">Wynik ręczny</div>
                      <Select name="result" defaultValue={item.result ?? "WIN"} className="w-40">
                        <option value="WIN">Trafiona</option>
                        <option value="LOSS">Nietrafiona</option>
                        <option value="PUSH">Push</option>
                        <option value="VOID">Void</option>
                      </Select>
                    </div>
                    <Button type="submit" variant="secondary">Rozlicz ręcznie</Button>
                    <div className="text-xs text-zinc-500">Ręczne rozliczenie jest zapisywane w audycie i może poprawić brakujące dane źródłowe.</div>
                  </form>
                ) : null}

                <div className="text-xs text-zinc-500">
                  Źródło wpisu: {item.source === "SCANNER" ? "Skaner" : "Ręczne"} · status historyczny: {item.evidenceStatus ?? "brak"} · utworzono {dateTime(item.createdAt)}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!items.length ? (
          <Card className="p-10 text-center text-zinc-500">
            Brak pozycji pasujących do wybranych filtrów.
          </Card>
        ) : null}
      </div>
    </div>
  );
}
