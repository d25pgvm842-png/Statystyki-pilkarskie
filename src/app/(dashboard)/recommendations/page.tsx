import Form from "next/form";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardPlus,
  Download,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import { refreshDailyRecommendationsAction } from "@/lib/actions/daily-recommendation-actions";
import { addRecommendationToPlayPlanAction } from "@/lib/actions/play-plan-actions";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { loadDailyRecommendations } from "@/lib/data/daily-recommendations";
import { warsawDateKey } from "@/lib/data/play-plan";
import {
  dailyRecommendationPriorityClass,
  dailyRecommendationPriorityLabel,
  type DailyRecommendationPriority,
} from "@/lib/stats/daily-recommendations";
import {
  strategyHealthStatusClass,
  strategyHealthStatusLabel,
} from "@/lib/stats/strategy-monitoring";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function hoursParam(value: string) {
  const parsed = Number(value);
  return [24, 48, 72, 168].includes(parsed) ? parsed : 48;
}

function priorityParam(value: string): DailyRecommendationPriority | "ALL" {
  return value === "TOP" || value === "VALUE" || value === "WATCH" || value === "BLOCKED"
    ? value
    : "ALL";
}

function percent(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined ? "—" : `${formatNumber(value, digits)}%`;
}

function decimal(value: number | null | undefined, digits = 2) {
  return value === null || value === undefined ? "—" : formatNumber(value, digits);
}

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function sourceLabel(value: string) {
  return value === "SCANNER" ? "Skaner" : "Warsztat / ręczne";
}

function sideLabel(value: string) {
  return value === "UNDER" ? "Under" : "Over";
}

function scopeLabel(value: string, teamName: string | null) {
  if (value === "TEAM_FOR") return teamName ? `Drużyna: ${teamName}` : "Suma drużyny";
  return "Suma meczu";
}

function marketStatusLabel(value: string | null) {
  if (value === "POTENTIAL_VALUE") return "Potencjalne value";
  if (value === "WATCH") return "Obserwacja";
  if (value === "NO_EDGE") return "Brak przewagi";
  if (value === "NO_ODDS") return "Brak kursu";
  if (value === "INSUFFICIENT_DATA") return "Za mało danych";
  return "Brak oceny rynku";
}

function evidenceLabel(value: string | null) {
  if (value === "SUPPORTED") return "Wsparte historią";
  if (value === "WATCH") return "Do obserwacji";
  if (value === "WEAK") return "Słaba historia";
  if (value === "UNVERIFIED") return "Niezweryfikowane";
  if (value === "POTENTIAL_VALUE") return "Value z warsztatu";
  return "Brak oceny";
}

function scoreClass(score: number) {
  if (score >= 75) return "text-emerald-600";
  if (score >= 58) return "text-blue-600";
  if (score >= 35) return "text-amber-600";
  return "text-red-600";
}

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const hours = hoursParam(stringParam(params.hours));
  const leagueId = stringParam(params.leagueId) || null;
  const priority = priorityParam(stringParam(params.priority));
  const loaded = await loadDailyRecommendations({
    userId: user.id,
    hours,
    leagueId,
    priority,
  });

  const exportQuery = new URLSearchParams({ hours: String(hours), priority });
  if (leagueId) exportQuery.set("leagueId", leagueId);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="text-emerald-600" size={25} />
            <h1 className="text-2xl font-semibold">Centrum rekomendacji dnia</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Jeden ekran dla kursu, EV, modelu, backtestu, strategii i limitów ekspozycji.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={refreshDailyRecommendationsAction}>
            <input type="hidden" name="hours" value={hours} />
            <Button type="submit" variant="secondary">
              <RefreshCw size={16} className="mr-2" />Odśwież sygnały i nadzór
            </Button>
          </form>
          <Link
            href={`/recommendations/export?${exportQuery.toString()}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <Download size={16} className="mr-2" />Eksport CSV
          </Link>
        </div>
      </div>

      {stringParam(params.refreshed) ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          Odświeżono centrum. Nowe sygnały forward: {stringParam(params.captured) || "0"}. Ocenione strategie: {stringParam(params.evaluated) || "0"}. Zmienione oceny: {stringParam(params.changed) || "0"}.
        </div>
      ) : null}
      {stringParam(params.error) ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {stringParam(params.error) === "blocked" ? "Odrzuconej rekomendacji nie można dodać do planu."
            : stringParam(params.error) === "alreadyPlayed" ? "Pozycja jest już oznaczona jako zagrana."
              : "Nie udało się dodać rekomendacji do planu."}
        </div>
      ) : null}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
        Centrum porządkuje zapisane sygnały. Nie obstawia automatycznie. Priorytet A wymaga dodatniego EV, kompletu kursu i modelu oraz bezpiecznego wsparcia aktywnej strategii.
      </div>

      <Card>
        <CardContent>
          <Form action="/recommendations" className="grid gap-3 md:grid-cols-[0.8fr_1.2fr_1fr_auto]">
            <Select name="hours" defaultValue={String(hours)}>
              <option value="24">Najbliższe 24 h</option>
              <option value="48">Najbliższe 48 h</option>
              <option value="72">Najbliższe 72 h</option>
              <option value="168">Najbliższe 7 dni</option>
            </Select>
            <Select name="leagueId" defaultValue={leagueId ?? ""}>
              <option value="">Wszystkie ligi</option>
              {loaded.leagues.map((league) => (
                <option key={league.id} value={league.id}>{league.name}</option>
              ))}
            </Select>
            <Select name="priority" defaultValue={priority}>
              <option value="ALL">Wszystkie priorytety</option>
              <option value="TOP">Priorytet A</option>
              <option value="VALUE">Priorytet B</option>
              <option value="WATCH">Obserwuj</option>
              <option value="BLOCKED">Odrzuć</option>
            </Select>
            <Button type="submit"><Target size={16} className="mr-2" />Pokaż</Button>
          </Form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <Card className="p-4"><div className="text-xs text-zinc-500">Wszystkie</div><div className="mt-1 text-2xl font-semibold">{loaded.summary.total}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Priorytet A</div><div className="mt-1 text-2xl font-semibold text-emerald-600">{loaded.summary.top}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Priorytet B</div><div className="mt-1 text-2xl font-semibold text-blue-600">{loaded.summary.value}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Obserwuj</div><div className="mt-1 text-2xl font-semibold text-amber-600">{loaded.summary.watch}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Odrzuć</div><div className="mt-1 text-2xl font-semibold text-red-600">{loaded.summary.blocked}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Braki rynku</div><div className="mt-1 text-2xl font-semibold">{loaded.summary.missingMarketData}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Alert ekspozycji</div><div className="mt-1 text-2xl font-semibold text-red-600">{loaded.summary.exposureWarnings}</div></Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
        <div className="flex items-center gap-2"><CalendarClock size={16} />Zakres do {dateTime(loaded.until)}</div>
        <div>{loaded.recommendations.length} widocznych z {loaded.summary.total}</div>
      </div>

      {loaded.recommendations.length ? (
        <div className="grid gap-4">
          {loaded.recommendations.map(({ item, strategies, conflict, evaluation }) => (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{item.match.homeTeam.name} – {item.match.awayTeam.name}</CardTitle>
                      {item.status === "PLAYED" ? (
                        <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">W grze</span>
                      ) : null}
                      {conflict ? (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">Konflikt kierunków</span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      {item.match.season.league.name} · {item.match.season.name} · {dateTime(item.match.kickoffAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-zinc-500">Ocena</div>
                      <div className={`text-3xl font-semibold ${scoreClass(evaluation.score)}`}>{evaluation.score}</div>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${dailyRecommendationPriorityClass(evaluation.priority)}`}>
                      {dailyRecommendationPriorityLabel(evaluation.priority)}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="grid gap-4 pt-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
                  <div><div className="text-xs text-zinc-500">Rynek</div><div className="font-semibold">{item.statLabel}</div><div className="text-xs text-zinc-500">{scopeLabel(item.scope, item.selectedTeam?.name ?? null)}</div></div>
                  <div><div className="text-xs text-zinc-500">Kierunek</div><div className="font-semibold">{sideLabel(item.side)} {decimal(item.threshold, 1)}</div><div className="text-xs text-zinc-500">{sourceLabel(item.source)}</div></div>
                  <div><div className="text-xs text-zinc-500">Kurs</div><div className="font-semibold">{decimal(item.odds)}</div><div className="text-xs text-zinc-500">{item.bookmaker ?? "Brak bukmachera"}</div></div>
                  <div><div className="text-xs text-zinc-500">EV</div><div className={`font-semibold ${item.expectedValue !== null && item.expectedValue >= 0 ? "text-emerald-600" : "text-red-600"}`}>{percent(item.expectedValue)}</div><div className="text-xs text-zinc-500">fair {decimal(item.fairOdds)}</div></div>
                  <div><div className="text-xs text-zinc-500">Model</div><div className="font-semibold">{percent(item.modelProbability)}</div><div className="text-xs text-zinc-500">próba {item.modelSample ?? "—"} · pokrycie {percent(item.modelCoverage)}</div></div>
                  <div><div className="text-xs text-zinc-500">Rynek / dowód</div><div className="font-semibold">{marketStatusLabel(item.marketStatus)}</div><div className="text-xs text-zinc-500">{evidenceLabel(item.evidenceStatus)}</div></div>
                  <div><div className="text-xs text-zinc-500">Strategie</div><div className="font-semibold">{strategies.length}</div><div className="text-xs text-zinc-500">{evaluation.hasSafeStrategy ? "bezpieczne wsparcie" : "brak bezpiecznego wsparcia"}</div></div>
                </div>

                {strategies.length ? (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {strategies.map((strategy) => (
                      <div key={strategy.strategyVersionId} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">{strategy.strategyName} · v{strategy.version}</div>
                            <div className="mt-1 text-xs text-zinc-500">status {strategy.operationalStatus.toLocaleLowerCase("pl")}</div>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${strategyHealthStatusClass(strategy.healthStatus)}`}>
                            {strategyHealthStatusLabel(strategy.healthStatus)} {strategy.healthScore ?? "—"}
                          </span>
                        </div>
                        <div className={`mt-2 text-xs ${strategy.exposureStatus === "OK" ? "text-emerald-600" : "text-red-600"}`}>
                          Ekspozycja: {strategy.exposureStatus}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={16} />Mocne strony</div>
                    <div className="mt-2 grid gap-1 text-sm">
                      {evaluation.reasons.length ? evaluation.reasons.map((reason) => <div key={reason}>• {reason}</div>) : <div className="text-zinc-500">Brak dodatkowych potwierdzeń.</div>}
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300"><AlertTriangle size={16} />Uwagi</div>
                    <div className="mt-2 grid gap-1 text-sm">
                      {evaluation.warnings.length ? evaluation.warnings.map((warning) => <div key={warning}>• {warning}</div>) : <div className="text-zinc-500">Brak ostrzeżeń.</div>}
                    </div>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50/60 p-3 dark:border-red-900 dark:bg-red-950/20">
                    <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300"><ShieldAlert size={16} />Blokady</div>
                    <div className="mt-2 grid gap-1 text-sm">
                      {evaluation.blockers.length ? evaluation.blockers.map((blocker) => <div key={blocker}>• {blocker}</div>) : <div className="text-zinc-500">Brak blokad.</div>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {loaded.plannedPickIds.has(item.id) ? (
                    <Link href={`/play-plan?date=${warsawDateKey(item.match.kickoffAt)}`} className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <ClipboardPlus size={15} className="mr-2" />W planie
                    </Link>
                  ) : item.status === "WATCHING" && evaluation.priority !== "BLOCKED" ? (
                    <form action={addRecommendationToPlayPlanAction}>
                      <input type="hidden" name="pickId" value={item.id} />
                      <Button type="submit" size="sm"><ClipboardPlus size={15} className="mr-2" />Dodaj do planu</Button>
                    </form>
                  ) : null}
                  <Link href={`/analysis?matchId=${item.matchId}`} className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700">
                    <BarChart3 size={15} className="mr-2" />Analiza meczu
                  </Link>
                  <Link href="/journal" className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                    <BookOpen size={15} className="mr-2" />Dziennik
                  </Link>
                  {evaluation.bestStrategy ? (
                    <Link href={`/monitoring?versionId=${evaluation.bestStrategy.strategyVersionId}`} className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                      <ExternalLink size={15} className="mr-2" />Nadzór najlepszej strategii
                    </Link>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-14 text-center">
            <Sparkles className="mx-auto text-zinc-400" size={34} />
            <div className="mt-3 font-semibold">Brak zapisanych sygnałów w tym zakresie</div>
            <div className="mt-1 text-sm text-zinc-500">Najpierw zapisz kandydatury ze skanera lub warsztatu rynku.</div>
            <div className="mt-4 flex justify-center gap-2">
              <Link href="/scanner" className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700">Otwórz skaner</Link>
              <Link href="/journal" className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-700">Otwórz dziennik</Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
