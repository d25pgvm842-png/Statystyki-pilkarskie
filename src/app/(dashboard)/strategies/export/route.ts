import { requireUser } from "@/lib/auth";
import { loadStrategyEvaluation } from "@/lib/data/strategy-lab";
import {
  selectionClv,
  selectionProfit,
} from "@/lib/stats/analysis-journal";
import {
  strategyRuleSummary,
  strategyStabilityLabel,
  type StrategyMetrics,
  type StrategySegmentRow,
} from "@/lib/stats/strategy-lab";
import { BETTING_METRICS_VERSION } from "@/lib/stats/betting-metrics";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function safeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "strategia";
}

function appendMetrics(rows: unknown[][], title: string, metrics: StrategyMetrics) {
  rows.push([title]);
  rows.push(["metryka", "wartosc"]);
  rows.push(["wersja_metryk", BETTING_METRICS_VERSION]);
  rows.push(["sygnaly", metrics.totalEntries]);
  rows.push(["otwarte", metrics.openEntries]);
  rows.push(["rozliczone", metrics.settledEntries]);
  rows.push(["rozliczone_win_loss", metrics.resolvedEntries]);
  rows.push(["trafione", metrics.wins]);
  rows.push(["nietrafione", metrics.losses]);
  rows.push(["push", metrics.pushes]);
  rows.push(["void", metrics.voided]);
  rows.push(["trafnosc_procent", metrics.hitRate]);
  rows.push(["kalibracja_obserwacje", metrics.calibrationEntries]);
  rows.push(["kalibracja_trafnosc_procent", metrics.calibrationHitRate]);
  rows.push(["srednie_probability_modelu", metrics.averageModelProbability]);
  rows.push(["luka_kalibracji_pp", metrics.calibrationGap]);
  rows.push(["brier_score", metrics.brierScore]);
  rows.push(["srednie_ev_procent", metrics.averageExpectedValue]);
  rows.push(["sredni_kurs", metrics.averageOdds]);
  rows.push(["srednie_clv_procent", metrics.averageClv]);
  rows.push(["pozycje_finansowe", metrics.financialEntries]);
  rows.push(["obrot", metrics.financialEntries ? metrics.turnover : null]);
  rows.push(["profit", metrics.financialEntries ? metrics.profit : null]);
  rows.push(["roi_procent", metrics.financialEntries ? metrics.roi : null]);
  rows.push(["maksymalne_obsuniecie", metrics.maxDrawdown]);
  rows.push(["najdluzsza_seria_wygranych", metrics.longestWinStreak]);
  rows.push(["najdluzsza_seria_porazek", metrics.longestLossStreak]);
  rows.push(["mala_proba", metrics.smallSample ? "TAK" : "NIE"]);
  rows.push([]);
}

function appendSegments(rows: unknown[][], title: string, segments: StrategySegmentRow[]) {
  rows.push([title]);
  rows.push([
    "segment",
    "sygnaly",
    "rozliczone_win_loss",
    "trafione",
    "nietrafione",
    "trafnosc_procent",
    "kalibracja_obserwacje",
    "kalibracja_trafnosc_procent",
    "srednie_probability_modelu",
    "luka_kalibracji_pp",
    "brier_score",
    "srednie_ev_procent",
    "pozycje_finansowe",
    "obrot",
    "profit",
    "roi_procent",
    "maksymalne_obsuniecie",
    "mala_proba",
  ]);
  for (const segment of segments) {
    rows.push([
      segment.label,
      segment.totalEntries,
      segment.resolvedEntries,
      segment.wins,
      segment.losses,
      segment.hitRate,
      segment.calibrationEntries,
      segment.calibrationHitRate,
      segment.averageModelProbability,
      segment.calibrationGap,
      segment.brierScore,
      segment.averageExpectedValue,
      segment.financialEntries,
      segment.financialEntries ? segment.turnover : null,
      segment.financialEntries ? segment.profit : null,
      segment.financialEntries ? segment.roi : null,
      segment.maxDrawdown,
      segment.smallSample ? "TAK" : "NIE",
    ]);
  }
  rows.push([]);
}

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const strategyId = url.searchParams.get("strategyId")?.trim() ?? "";
  if (!strategyId) return new Response("Brak strategii.", { status: 400 });

  const loaded = await loadStrategyEvaluation({ userId: user.id, strategyId });
  if (!loaded) return new Response("Nie znaleziono strategii.", { status: 404 });

  const { strategy, config, evaluation } = loaded;
  const resolved = evaluation.matchedEntries.filter(
    (entry) => entry.status === "SETTLED" && (entry.result === "WIN" || entry.result === "LOSS"),
  );
  const trainingSize = resolved.length < 2 ? resolved.length : Math.max(1, Math.floor(resolved.length * 0.7));
  const trainingIds = new Set(resolved.slice(0, trainingSize).map((entry) => entry.id));
  const validationIds = new Set(resolved.slice(trainingSize).map((entry) => entry.id));

  const rows: unknown[][] = [
    ["LABORATORIUM STRATEGII"],
    ["nazwa", strategy.name],
    ["opis", strategy.description],
    ["aktywna", strategy.active ? "TAK" : "NIE"],
    ["regula", strategyRuleSummary(config)],
    ["walidacja", strategyStabilityLabel(evaluation.stability)],
    ["utworzono", strategy.createdAt.toISOString()],
    ["zaktualizowano", strategy.updatedAt.toISOString()],
    [],
    ["KONFIGURACJA"],
    ["pole", "wartosc"],
    ...Object.entries(config).map(([field, value]) => [field, value]),
    [],
  ];

  appendMetrics(rows, "WYNIK CALOSCI", evaluation.metrics);
  appendMetrics(rows, "PROBA ROBOCZA 70 PROCENT", evaluation.training);
  appendMetrics(rows, "WALIDACJA 30 PROCENT", evaluation.validation);
  appendSegments(rows, "STABILNOSC MIESIECZNA", evaluation.byMonth);
  appendSegments(rows, "WEDLUG LIGI", evaluation.byLeague);
  appendSegments(rows, "WEDLUG RYNKU", evaluation.byMarket);
  appendSegments(rows, "OVER_UNDER", evaluation.bySide);
  appendSegments(rows, "WEDLUG WERSJI MODELU", evaluation.byModelVersion);

  rows.push(["DECYZJE"]);
  rows.push([
    "zbior",
    "data_meczu",
    "data_zapisu",
    "data_kursu",
    "liga",
    "sezon",
    "gospodarz",
    "gosc",
    "rynek",
    "linia",
    "zakres",
    "cel",
    "kierunek",
    "zrodlo",
    "status_decyzji",
    "wynik",
    "projekcja",
    "przewaga",
    "status_historyczny",
    "backtest_proba",
    "backtest_trafnosc",
    "model_probability",
    "ev_procent",
    "model_proba",
    "model_pokrycie",
    "model_wiarygodnosc",
    "wersja_modelu",
    "status_rynku",
    "bukmacher",
    "kurs",
    "kurs_zamkniecia",
    "clv_procent",
    "stawka",
    "profit",
  ]);

  for (const entry of evaluation.matchedEntries) {
    const split = trainingIds.has(entry.id)
      ? "TRAINING"
      : validationIds.has(entry.id)
        ? "VALIDATION"
        : entry.kickoffAt.getTime() >= Date.now() && !entry.result
          ? "CURRENT"
          : "OTHER";
    rows.push([
      split,
      entry.kickoffAt.toISOString(),
      entry.createdAt.toISOString(),
      entry.quoteCapturedAt?.toISOString() ?? null,
      entry.leagueName,
      entry.seasonName,
      entry.homeTeamName,
      entry.awayTeamName,
      entry.statLabel,
      entry.threshold,
      entry.scope,
      entry.target,
      entry.side,
      entry.source,
      entry.status,
      entry.result,
      entry.projection,
      entry.edge,
      entry.evidenceStatus,
      entry.backtestSignals,
      entry.backtestHitRate,
      entry.modelProbability,
      entry.expectedValue,
      entry.modelSample,
      entry.modelCoverage,
      entry.modelConfidence,
      entry.modelVersion,
      entry.marketStatus,
      entry.bookmaker,
      entry.odds,
      entry.closingOdds,
      selectionClv({ odds: entry.odds, closingOdds: entry.closingOdds }),
      entry.stake,
      selectionProfit({ result: entry.result, odds: entry.odds, stake: entry.stake }),
    ]);
  }

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="strategia-${safeName(strategy.name)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
