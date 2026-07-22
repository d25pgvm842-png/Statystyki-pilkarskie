import { requireUser } from "@/lib/auth";
import { loadDailyPlayPlan } from "@/lib/data/play-plan";
import { BETTING_METRICS_VERSION } from "@/lib/stats/betting-metrics";
import { dailyRecommendationPriorityLabel } from "@/lib/stats/daily-recommendations";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const dateKey = url.searchParams.get("date")?.trim() || null;
  const loaded = await loadDailyPlayPlan({ userId: user.id, dateKey });
  if (!loaded.plan) return new Response("Nie znaleziono planu.", { status: 404 });

  const summary = loaded.daySummary;
  const rows: unknown[][] = [
    ["PLAN GRY DNIA · PLAN VS FAKTYCZNIE"],
    ["data", loaded.dateKey],
    ["status", loaded.plan.status],
    ["wersja_metryk", BETTING_METRICS_VERSION],
    ["kapital", loaded.plan.bankroll],
    ["limit_dnia_procent", loaded.plan.maxDailyStakePercent],
    ["limit_meczu_procent", loaded.plan.maxMatchStakePercent],
    ["limit_ligi_procent", loaded.plan.maxLeagueStakePercent],
    ["limit_rynku_procent", loaded.plan.maxMarketStakePercent],
    ["liczba_pozycji", summary.totalItems],
    ["oczekujace", summary.selectedItems],
    ["zagrane_otwarte", summary.playedItems],
    ["rozliczone", summary.settledItems],
    ["void", summary.voidItems],
    ["pominiete", summary.skippedItems],
    ["realizacja_procent", summary.executionRate],
    ["stawka_planowana", summary.plannedStake],
    ["stawka_faktyczna", summary.executedStake],
    ["roznica_stawki", summary.stakeDifference],
    ["obrot", summary.turnover],
    ["profit", summary.profit],
    ["roi_procent", summary.roi],
    ["sredni_clv_procent", summary.averageClv],
    ["blokady", loaded.evaluation.blockers.join(" | ")],
    ["uwagi", loaded.evaluation.warnings.join(" | ")],
    [],
    [
      "id",
      "status_planu",
      "status_lifecycle",
      "priorytet",
      "ocena",
      "data_meczu",
      "liga",
      "sezon",
      "gospodarz",
      "gosc",
      "rynek",
      "zakres",
      "kierunek",
      "linia",
      "kurs_planowany",
      "kurs_faktyczny",
      "roznica_kursu",
      "bukmacher_planowany",
      "bukmacher_faktyczny",
      "zmiana_bukmachera",
      "stawka_planowana",
      "stawka_faktyczna",
      "roznica_stawki",
      "roznica_stawki_procent",
      "czas_snapshotu",
      "czas_zagrania",
      "opoznienie_minuty",
      "wynik",
      "wartosc_faktyczna",
      "czas_rozliczenia",
      "profit",
      "clv_procent",
      "powod_pominiecia",
      "notatka_pominiecia",
      "czas_pominiecia",
      "ev_procent",
      "p_modelu_procent",
      "fair_odds",
      "strategia",
      "kondycja_strategii",
      "ekspozycja_strategii",
      "uzasadnienie",
      "blokady_pozycji",
      "uwagi_pozycji",
    ],
  ];

  for (const item of loaded.items) {
    const snapshot = item.snapshot;
    const reconciliation = item.reconciliation;
    const assessment = loaded.evaluation.itemAssessments[item.id];
    rows.push([
      item.id,
      item.status,
      reconciliation.lifecycleStatus,
      dailyRecommendationPriorityLabel(snapshot.recommendationPriority),
      snapshot.recommendationScore,
      snapshot.kickoffAt,
      snapshot.leagueName,
      snapshot.seasonName,
      snapshot.homeTeamName,
      snapshot.awayTeamName,
      snapshot.statLabel,
      snapshot.scope,
      snapshot.side,
      snapshot.threshold,
      reconciliation.plannedOdds,
      reconciliation.actualOdds,
      reconciliation.oddsDelta,
      reconciliation.plannedBookmaker,
      reconciliation.actualBookmaker,
      reconciliation.bookmakerChanged,
      reconciliation.plannedStake,
      reconciliation.actualStake,
      reconciliation.stakeDelta,
      reconciliation.stakeDeltaPercent,
      reconciliation.capturedAt.toISOString(),
      reconciliation.placedAt?.toISOString() ?? null,
      reconciliation.executionDelayMinutes,
      reconciliation.result,
      reconciliation.actualValue,
      reconciliation.settledAt?.toISOString() ?? null,
      reconciliation.profit,
      reconciliation.clv,
      reconciliation.skipReasonLabel,
      reconciliation.skipNote,
      reconciliation.skippedAt?.toISOString() ?? null,
      snapshot.expectedValue,
      snapshot.modelProbability,
      snapshot.fairOdds,
      snapshot.bestStrategy?.strategyName ?? null,
      snapshot.bestStrategy?.healthStatus ?? null,
      snapshot.bestStrategy?.exposureStatus ?? null,
      item.reason,
      assessment?.blockers.join(" | ") ?? null,
      assessment?.warnings.join(" | ") ?? null,
    ]);
  }

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="plan-gry-${loaded.dateKey}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
