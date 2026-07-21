import Form from "next/form";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  PlayCircle,
  RotateCcw,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  approvePlayPlanAction,
  archivePlayPlanAction,
  markPlayPlanItemPlayedAction,
  removePlayPlanItemAction,
  reopenPlayPlanAction,
  updatePlayPlanItemAction,
  updatePlayPlanSettingsAction,
} from "@/lib/actions/play-plan-actions";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { loadDailyPlayPlan } from "@/lib/data/play-plan";
import {
  dailyRecommendationPriorityClass,
  dailyRecommendationPriorityLabel,
} from "@/lib/stats/daily-recommendations";
import { playPlanStatusLabel } from "@/lib/stats/play-plan";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function currency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(value);
}

function percent(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined ? "—" : `${formatNumber(value, digits)}%`;
}

function decimal(value: number | null | undefined, digits = 2) {
  return value === null || value === undefined ? "—" : formatNumber(value, digits);
}

function dateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusClass(value: string) {
  if (value === "APPROVED") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (value === "ARCHIVED") return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
}

function eventLabel(value: string) {
  if (value === "ADD_ITEM") return "Dodano pozycję";
  if (value === "REMOVE_ITEM") return "Usunięto pozycję";
  if (value === "UPDATE_ITEM") return "Zmieniono pozycję";
  if (value === "UPDATE_SETTINGS") return "Zmieniono limity";
  if (value === "APPROVE") return "Zatwierdzono plan";
  if (value === "REOPEN") return "Przywrócono tryb roboczy";
  if (value === "PLAY_ITEM") return "Przeniesiono do dziennika";
  if (value === "ARCHIVE") return "Zarchiwizowano plan";
  return value;
}

function scopeLabel(scope: string, target: string) {
  if (scope === "TEAM_FOR") return target === "MATCH" ? "Suma drużyny" : "Drużyna";
  if (scope === "TEAM_AGAINST") return "Przeciw drużynie";
  return "Suma meczu";
}

export default async function PlayPlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const loaded = await loadDailyPlayPlan({
    userId: user.id,
    dateKey: stringParam(params.date) || null,
  });
  const { plan, items, evaluation } = loaded;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="text-emerald-600" size={25} />
            <h1 className="text-2xl font-semibold">Plan gry dnia</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Zamrożony wybór rekomendacji, stawki, konflikty i limity przed przeniesieniem do dziennika.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {plan ? (
            <Link
              href={`/play-plan/export?date=${loaded.dateKey}`}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              <Download size={16} className="mr-2" />Eksport CSV
            </Link>
          ) : null}
          <Link
            href="/recommendations"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Sparkles size={16} className="mr-2" />Centrum dnia
          </Link>
        </div>
      </div>

      <Card>
        <CardContent>
          <Form action="/play-plan" className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-500">Dzień planu</span>
              <Input type="date" name="date" defaultValue={loaded.dateKey} className="w-48" />
            </label>
            <Button type="submit"><CalendarDays size={16} className="mr-2" />Pokaż</Button>
          </Form>
        </CardContent>
      </Card>

      {stringParam(params.added) ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">Pozycja została dodana do planu.</div> : null}
      {stringParam(params.approved) ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">Plan zatwierdzony. Przeniesienie pozycji do dziennika nadal wymaga osobnego kliknięcia.</div> : null}
      {stringParam(params.played) ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">Pozycja została oznaczona jako zagrana i zapisana w dzienniku.</div> : null}
      {stringParam(params.error) ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {stringParam(params.error) === "blocked" ? "Plan ma blokady. Usuń je przed zatwierdzeniem."
            : stringParam(params.error) === "played" ? "Planu z zagraną pozycją nie można przywrócić do trybu roboczego."
              : stringParam(params.error) === "started" ? "Mecz już się rozpoczął. Pozycji nie przeniesiono do dziennika."
                : stringParam(params.error) === "missingMarket" ? "Brakuje prawidłowego kursu lub stawki."
                  : stringParam(params.error) === "locked" ? "Plan jest zablokowany do edycji w obecnym statusie."
                    : "Nie udało się wykonać operacji na planie."}
        </div>
      ) : null}

      {loaded.history.length ? (
        <div className="flex flex-wrap gap-2">
          {loaded.history.map((entry) => {
            const key = entry.planDate.toISOString().slice(0, 10);
            return (
              <Link
                key={entry.id}
                href={`/play-plan?date=${key}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${key === loaded.dateKey ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-zinc-300 dark:border-zinc-700"}`}
              >
                {key} · {entry._count.items} · {playPlanStatusLabel(entry.status)}
              </Link>
            );
          })}
        </div>
      ) : null}

      {!plan ? (
        <Card>
          <CardContent className="py-14 text-center">
            <ClipboardList className="mx-auto text-zinc-400" size={36} />
            <div className="mt-3 font-semibold">Brak planu na {loaded.dateKey}</div>
            <div className="mt-1 text-sm text-zinc-500">Dodaj pierwszą pozycję z Centrum rekomendacji dnia. Plan utworzy się automatycznie.</div>
            <Link href="/recommendations" className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700">Otwórz rekomendacje</Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Plan {loaded.dateKey}</CardTitle>
                  <div className="mt-1 text-sm text-zinc-500">Utworzono {dateTime(plan.createdAt)}{plan.approvedAt ? ` · zatwierdzono ${dateTime(plan.approvedAt)}` : ""}</div>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${statusClass(plan.status)}`}>{playPlanStatusLabel(plan.status)}</span>
              </div>
            </CardHeader>
            <CardContent>
              {plan.status === "DRAFT" ? (
                <form action={updatePlayPlanSettingsAction} className="grid gap-3 xl:grid-cols-5">
                  <input type="hidden" name="planId" value={plan.id} />
                  <label className="grid gap-1 text-sm"><span className="text-zinc-500">Kapitał</span><Input name="bankroll" type="number" min="1" step="0.01" defaultValue={plan.bankroll} /></label>
                  <label className="grid gap-1 text-sm"><span className="text-zinc-500">Limit dnia %</span><Input name="maxDailyStakePercent" type="number" min="0.01" max="100" step="0.01" defaultValue={plan.maxDailyStakePercent} /></label>
                  <label className="grid gap-1 text-sm"><span className="text-zinc-500">Limit meczu %</span><Input name="maxMatchStakePercent" type="number" min="0.01" max="100" step="0.01" defaultValue={plan.maxMatchStakePercent} /></label>
                  <label className="grid gap-1 text-sm"><span className="text-zinc-500">Limit ligi %</span><Input name="maxLeagueStakePercent" type="number" min="0.01" max="100" step="0.01" defaultValue={plan.maxLeagueStakePercent} /></label>
                  <label className="grid gap-1 text-sm"><span className="text-zinc-500">Limit rynku %</span><Input name="maxMarketStakePercent" type="number" min="0.01" max="100" step="0.01" defaultValue={plan.maxMarketStakePercent} /></label>
                  <label className="grid gap-1 text-sm xl:col-span-4"><span className="text-zinc-500">Notatka planu</span><Textarea name="note" defaultValue={plan.note ?? ""} rows={2} /></label>
                  <div className="flex items-end"><Button type="submit"><Save size={16} className="mr-2" />Zapisz limity</Button></div>
                </form>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 text-sm">
                  <div><div className="text-xs text-zinc-500">Kapitał</div><div className="font-semibold">{currency(plan.bankroll)}</div></div>
                  <div><div className="text-xs text-zinc-500">Limit dnia</div><div className="font-semibold">{percent(plan.maxDailyStakePercent)}</div></div>
                  <div><div className="text-xs text-zinc-500">Limit meczu</div><div className="font-semibold">{percent(plan.maxMatchStakePercent)}</div></div>
                  <div><div className="text-xs text-zinc-500">Limit ligi</div><div className="font-semibold">{percent(plan.maxLeagueStakePercent)}</div></div>
                  <div><div className="text-xs text-zinc-500">Limit rynku</div><div className="font-semibold">{percent(plan.maxMarketStakePercent)}</div></div>
                  {plan.note ? <div className="sm:col-span-2 xl:col-span-5"><div className="text-xs text-zinc-500">Notatka</div><div>{plan.note}</div></div> : null}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <Card className="p-4"><div className="text-xs text-zinc-500">Pozycje</div><div className="mt-1 text-2xl font-semibold">{evaluation.items}</div></Card>
            <Card className="p-4"><div className="text-xs text-zinc-500">Zagrane</div><div className="mt-1 text-2xl font-semibold">{evaluation.playedItems}</div></Card>
            <Card className="p-4"><div className="text-xs text-zinc-500">Stawka</div><div className="mt-1 text-2xl font-semibold">{currency(evaluation.totalStake)}</div></Card>
            <Card className="p-4"><div className="text-xs text-zinc-500">Kapitał w grze</div><div className="mt-1 text-2xl font-semibold">{percent(evaluation.stakePercent)}</div></Card>
            <Card className="p-4"><div className="text-xs text-zinc-500">Śr. ocena</div><div className="mt-1 text-2xl font-semibold">{decimal(evaluation.averageScore, 1)}</div></Card>
            <Card className="p-4"><div className="text-xs text-zinc-500">Ważone EV</div><div className="mt-1 text-2xl font-semibold text-emerald-600">{percent(evaluation.weightedExpectedValue)}</div></Card>
            <Card className="p-4"><div className="text-xs text-zinc-500">Oczekiwany profit</div><div className="mt-1 text-2xl font-semibold text-emerald-600">{currency(evaluation.expectedProfit)}</div></Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/20">
              <div className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300"><ShieldAlert size={17} />Blokady planu</div>
              <div className="mt-2 grid gap-1 text-sm">{evaluation.blockers.length ? evaluation.blockers.map((item) => <div key={item}>• {item}</div>) : <div className="text-zinc-500">Brak blokad.</div>}</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300"><AlertTriangle size={17} />Uwagi</div>
              <div className="mt-2 grid gap-1 text-sm">{evaluation.warnings.length ? evaluation.warnings.map((item) => <div key={item}>• {item}</div>) : <div className="text-zinc-500">Brak ostrzeżeń.</div>}</div>
            </div>
          </div>

          <div className="grid gap-4">
            {items.map((item) => {
              const snapshot = item.snapshot;
              const assessment = evaluation.itemAssessments[item.id];
              return (
                <Card key={item.id} className="overflow-hidden">
                  <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle>{snapshot.homeTeamName} – {snapshot.awayTeamName}</CardTitle>
                        <div className="mt-1 text-sm text-zinc-500">{snapshot.leagueName} · {snapshot.seasonName} · {dateTime(snapshot.kickoffAt)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "PLAYED" ? <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">W dzienniku</span> : null}
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${dailyRecommendationPriorityClass(snapshot.recommendationPriority)}`}>{dailyRecommendationPriorityLabel(snapshot.recommendationPriority)}</span>
                        <span className="text-xl font-semibold">{snapshot.recommendationScore}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 pt-5">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7 text-sm">
                      <div><div className="text-xs text-zinc-500">Rynek</div><div className="font-semibold">{snapshot.statLabel}</div><div className="text-xs text-zinc-500">{scopeLabel(snapshot.scope, snapshot.target)}</div></div>
                      <div><div className="text-xs text-zinc-500">Kierunek</div><div className="font-semibold">{snapshot.side} {decimal(snapshot.threshold, 1)}</div></div>
                      <div><div className="text-xs text-zinc-500">Kurs</div><div className="font-semibold">{decimal(item.oddsSnapshot)}</div><div className="text-xs text-zinc-500">{item.bookmakerSnapshot ?? "—"}</div></div>
                      <div><div className="text-xs text-zinc-500">Stawka</div><div className="font-semibold">{currency(item.plannedStake)}</div></div>
                      <div><div className="text-xs text-zinc-500">EV</div><div className="font-semibold text-emerald-600">{percent(snapshot.expectedValue)}</div></div>
                      <div><div className="text-xs text-zinc-500">Model</div><div className="font-semibold">{percent(snapshot.modelProbability)}</div><div className="text-xs text-zinc-500">fair {decimal(snapshot.fairOdds)}</div></div>
                      <div><div className="text-xs text-zinc-500">Strategia</div><div className="font-semibold">{snapshot.bestStrategy?.strategyName ?? "—"}</div><div className="text-xs text-zinc-500">{snapshot.bestStrategy ? `${snapshot.bestStrategy.healthStatus} · ${snapshot.bestStrategy.exposureStatus}` : "brak"}</div></div>
                    </div>

                    {(assessment?.blockers.length || assessment?.warnings.length) ? (
                      <div className="grid gap-2 lg:grid-cols-2 text-sm">
                        {assessment.blockers.length ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">{assessment.blockers.map((value) => <div key={value}>• {value}</div>)}</div> : <div />}
                        {assessment.warnings.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">{assessment.warnings.map((value) => <div key={value}>• {value}</div>)}</div> : null}
                      </div>
                    ) : null}

                    {plan.status === "DRAFT" && item.status !== "PLAYED" ? (
                      <div className="grid gap-3">
                        <form action={updatePlayPlanItemAction} className="grid gap-3 md:grid-cols-4">
                          <input type="hidden" name="itemId" value={item.id} />
                          <label className="grid gap-1 text-sm"><span className="text-zinc-500">Stawka</span><Input name="plannedStake" type="number" min="0.01" step="0.01" defaultValue={item.plannedStake ?? ""} /></label>
                          <label className="grid gap-1 text-sm"><span className="text-zinc-500">Kurs</span><Input name="oddsSnapshot" type="number" min="1.01" step="0.01" defaultValue={item.oddsSnapshot ?? ""} /></label>
                          <label className="grid gap-1 text-sm"><span className="text-zinc-500">Bukmacher</span><Input name="bookmakerSnapshot" defaultValue={item.bookmakerSnapshot ?? ""} /></label>
                          <div className="flex items-end"><Button type="submit"><Save size={16} className="mr-2" />Zapisz</Button></div>
                          <label className="grid gap-1 text-sm md:col-span-4"><span className="text-zinc-500">Uzasadnienie / uwaga</span><Textarea name="reason" defaultValue={item.reason ?? ""} rows={2} /></label>
                        </form>
                        <form action={removePlayPlanItemAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <Button type="submit" variant="danger" size="sm"><Trash2 size={15} className="mr-2" />Usuń z planu</Button>
                        </form>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {plan.status === "APPROVED" && item.status !== "PLAYED" ? (
                          <form action={markPlayPlanItemPlayedAction}>
                            <input type="hidden" name="itemId" value={item.id} />
                            <Button type="submit"><PlayCircle size={16} className="mr-2" />Oznacz jako zagrane</Button>
                          </form>
                        ) : null}
                        <Link href={`/analysis?matchId=${snapshot.matchId}`} className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"><ExternalLink size={15} className="mr-2" />Analiza meczu</Link>
                        <Link href="/journal" className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"><BookOpen size={15} className="mr-2" />Dziennik</Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardContent className="flex flex-wrap gap-2">
              {plan.status === "DRAFT" ? (
                <form action={approvePlayPlanAction}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <Button type="submit" disabled={!evaluation.approvable}><CheckCircle2 size={16} className="mr-2" />Zatwierdź plan</Button>
                </form>
              ) : null}
              {plan.status === "APPROVED" ? (
                <form action={reopenPlayPlanAction}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <Button type="submit" variant="secondary"><RotateCcw size={16} className="mr-2" />Wróć do edycji</Button>
                </form>
              ) : null}
              {plan.status !== "ARCHIVED" ? (
                <form action={archivePlayPlanAction}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <Button type="submit" variant="ghost"><Archive size={16} className="mr-2" />Archiwizuj</Button>
                </form>
              ) : null}
            </CardContent>
          </Card>

          {plan.events.length ? (
            <Card>
              <CardHeader><CardTitle>Historia planu</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {plan.events.map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 py-2 text-sm last:border-0 dark:border-zinc-800"><span>{eventLabel(event.type)}</span><span className="text-zinc-500">{dateTime(event.createdAt)}</span></div>)}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
