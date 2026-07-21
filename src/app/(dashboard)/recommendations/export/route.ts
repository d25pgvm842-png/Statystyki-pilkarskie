import { requireUser } from "@/lib/auth";
import { loadDailyRecommendations } from "@/lib/data/daily-recommendations";
import {
  dailyRecommendationPriorityLabel,
  type DailyRecommendationPriority,
} from "@/lib/stats/daily-recommendations";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function hoursParam(value: string | null) {
  const parsed = Number(value);
  return [24, 48, 72, 168].includes(parsed) ? parsed : 48;
}

function priorityParam(value: string | null): DailyRecommendationPriority | "ALL" {
  return value === "TOP" || value === "VALUE" || value === "WATCH" || value === "BLOCKED"
    ? value
    : "ALL";
}

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const hours = hoursParam(url.searchParams.get("hours"));
  const priority = priorityParam(url.searchParams.get("priority"));
  const leagueId = url.searchParams.get("leagueId")?.trim() || null;
  const loaded = await loadDailyRecommendations({
    userId: user.id,
    hours,
    priority,
    leagueId,
  });

  const rows: unknown[][] = [[
    "id",
    "priorytet",
    "ocena",
    "status_dziennika",
    "data_meczu",
    "liga",
    "sezon",
    "gospodarz",
    "gosc",
    "rynek",
    "zakres",
    "druzyna",
    "kierunek",
    "linia",
    "kurs",
    "bukmacher",
    "p_modelu_procent",
    "ev_procent",
    "fair_odds",
    "status_rynku",
    "dowod",
    "proba_modelu",
    "pokrycie_procent",
    "wiarygodnosc",
    "liczba_strategii",
    "najlepsza_strategia",
    "zdrowie_strategii",
    "ocena_strategii",
    "ekspozycja",
    "konflikt",
    "mocne_strony",
    "uwagi",
    "blokady",
  ]];

  for (const { item, strategies, conflict, evaluation } of loaded.recommendations) {
    rows.push([
      item.id,
      dailyRecommendationPriorityLabel(evaluation.priority),
      evaluation.score,
      item.status,
      item.match.kickoffAt.toISOString(),
      item.match.season.league.name,
      item.match.season.name,
      item.match.homeTeam.name,
      item.match.awayTeam.name,
      item.statLabel,
      item.scope,
      item.selectedTeam?.name ?? null,
      item.side,
      item.threshold,
      item.odds,
      item.bookmaker,
      item.modelProbability,
      item.expectedValue,
      item.fairOdds,
      item.marketStatus,
      item.evidenceStatus,
      item.modelSample,
      item.modelCoverage,
      item.modelConfidence,
      strategies.length,
      evaluation.bestStrategy?.strategyName ?? null,
      evaluation.bestStrategy?.healthStatus ?? null,
      evaluation.bestStrategy?.healthScore ?? null,
      evaluation.bestStrategy?.exposureStatus ?? null,
      conflict ? "TAK" : "NIE",
      evaluation.reasons.join(" | "),
      evaluation.warnings.join(" | "),
      evaluation.blockers.join(" | "),
    ]);
  }

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rekomendacje-${hours}h.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
