import { requireUser } from "@/lib/auth";
import { loadDailyPlayPlan } from "@/lib/data/play-plan";
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

  const rows: unknown[][] = [
    ["PLAN GRY DNIA"],
    ["data", loaded.dateKey],
    ["status", loaded.plan.status],
    ["kapital", loaded.plan.bankroll],
    ["limit_dnia_procent", loaded.plan.maxDailyStakePercent],
    ["limit_meczu_procent", loaded.plan.maxMatchStakePercent],
    ["limit_ligi_procent", loaded.plan.maxLeagueStakePercent],
    ["limit_rynku_procent", loaded.plan.maxMarketStakePercent],
    ["liczba_pozycji", loaded.evaluation.items],
    ["liczba_zagranych", loaded.evaluation.playedItems],
    ["laczna_stawka", loaded.evaluation.totalStake],
    ["procent_kapitalu", loaded.evaluation.stakePercent],
    ["wazone_ev_procent", loaded.evaluation.weightedExpectedValue],
    ["oczekiwany_profit", loaded.evaluation.expectedProfit],
    ["blokady", loaded.evaluation.blockers.join(" | ")],
    ["uwagi", loaded.evaluation.warnings.join(" | ")],
    [],
    [
      "id",
      "status",
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
      "kurs",
      "bukmacher",
      "stawka",
      "ev_procent",
      "p_modelu_procent",
      "fair_odds",
      "strategia",
      "kondycja_strategii",
      "ekspozycja_strategii",
      "uzasadnienie",
      "blokady_pozycji",
      "uwagi_pozycji",
      "snapshot_z_dnia",
    ],
  ];

  for (const item of loaded.items) {
    const snapshot = item.snapshot;
    const assessment = loaded.evaluation.itemAssessments[item.id];
    rows.push([
      item.id,
      item.status,
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
      item.oddsSnapshot,
      item.bookmakerSnapshot,
      item.plannedStake,
      snapshot.expectedValue,
      snapshot.modelProbability,
      snapshot.fairOdds,
      snapshot.bestStrategy?.strategyName ?? null,
      snapshot.bestStrategy?.healthStatus ?? null,
      snapshot.bestStrategy?.exposureStatus ?? null,
      item.reason,
      assessment?.blockers.join(" | ") ?? null,
      assessment?.warnings.join(" | ") ?? null,
      snapshot.capturedAt,
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
