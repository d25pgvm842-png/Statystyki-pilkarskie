import { requireUser } from "@/lib/auth";
import { loadAnalysisJournal } from "@/lib/data/analysis-journal";
import {
  selectionClv,
  selectionProfit,
  type JournalAnalyticsRow,
} from "@/lib/stats/analysis-journal";
import { TREND_STAT_DEFINITIONS } from "@/lib/stats/trends";
import { BETTING_METRICS_VERSION } from "@/lib/stats/betting-metrics";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function dateText(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? "" : value;
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

function appendAnalyticsSection(
  rows: unknown[][],
  title: string,
  analyticsRows: JournalAnalyticsRow[],
) {
  rows.push([title]);
  rows.push([
    "segment",
    "pozycje",
    "rozliczone",
    "trafione",
    "nietrafione",
    "push",
    "hit_rate_procent",
    "obrot",
    "profit",
    "roi_procent",
    "sredni_kurs",
    "srednie_clv_procent",
    "pozycje_finansowe",
    "mala_proba",
  ]);

  for (const row of analyticsRows) {
    rows.push([
      row.label,
      row.totalEntries,
      row.settled,
      row.wins,
      row.losses,
      row.pushes,
      row.hitRate,
      row.financialEntries ? row.turnover : null,
      row.financialEntries ? row.profit : null,
      row.financialEntries ? row.roi : null,
      row.averageOdds,
      row.averageClv,
      row.financialEntries,
      row.smallSample ? "TAK" : "NIE",
    ]);
  }

  rows.push([]);
}

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const seasonId = url.searchParams.get("seasonId");
  const leagueId = url.searchParams.get("leagueId");
  const statusParam = url.searchParams.get("status");
  const status = ["WATCHING", "PLAYED", "REJECTED", "SETTLED", "VOID"].includes(statusParam ?? "")
    ? statusParam
    : null;
  const statParam = url.searchParams.get("statKey");
  const statKey = TREND_STAT_DEFINITIONS.some((item) => item.key === statParam)
    ? statParam
    : null;
  const sourceParam = url.searchParams.get("source");
  const source = ["SCANNER", "MANUAL"].includes(sourceParam ?? "")
    ? sourceParam
    : null;
  const fromText = dateText(url.searchParams.get("from"));
  const toText = dateText(url.searchParams.get("to"));
  const mode = url.searchParams.get("mode");

  const { items, metrics, analytics } = await loadAnalysisJournal({
    userId: user.id,
    seasonId,
    leagueId,
    status,
    statKey,
    source,
    from: utcDate(fromText),
    to: nextUtcDay(toText),
  });

  if (mode === "analytics") {
    const rows: unknown[][] = [
      ["ANALITYKA DZIENNIKA"],
      ["filtr_liga_id", leagueId],
      ["filtr_sezon_id", seasonId],
      ["filtr_rynek", statKey],
      ["filtr_status", status],
      ["filtr_zrodlo", source],
      ["filtr_data_od", fromText],
      ["filtr_data_do", toText],
      [],
      ["PODSUMOWANIE"],
      ["metryka", "wartosc"],
      ["wersja_metryk", BETTING_METRICS_VERSION],
      ["pozycje", items.length],
      ["obserwowane", metrics.watching],
      ["zagrane_otwarte", metrics.playedOpen],
      ["rozliczone", metrics.settled],
      ["trafione", metrics.wins],
      ["nietrafione", metrics.losses],
      ["push", metrics.pushes],
      ["trafnosc_procent", metrics.hitRate],
      ["obrot", metrics.financialEntries ? metrics.turnover : null],
      ["profit", metrics.financialEntries ? metrics.profit : null],
      ["roi_procent", metrics.financialEntries ? metrics.roi : null],
      ["sredni_kurs", metrics.averageOdds],
      ["srednie_clv_procent", metrics.averageClv],
      [],
    ];

    appendAnalyticsSection(rows, "WEDLUG LIGI", analytics.byLeague);
    appendAnalyticsSection(rows, "WEDLUG RYNKU", analytics.byMarket);
    appendAnalyticsSection(rows, "OVER_UNDER", analytics.bySide);
    appendAnalyticsSection(rows, "WEDLUG ZRODLA", analytics.bySource);
    appendAnalyticsSection(rows, "WEDLUG STATUSU HISTORYCZNEGO", analytics.byEvidence);

    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="analityka-dziennika.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  const rows: unknown[][] = [
    ["metryka", "wartosc"],
    ["wersja_metryk", BETTING_METRICS_VERSION],
    ["obserwowane", metrics.watching],
    ["zagrane_otwarte", metrics.playedOpen],
    ["rozliczone", metrics.settled],
    ["trafnosc_procent", metrics.hitRate],
    ["obrot", metrics.financialEntries ? metrics.turnover : null],
    ["profit", metrics.financialEntries ? metrics.profit : null],
    ["roi_procent", metrics.roi],
    ["srednie_clv_procent", metrics.averageClv],
    [],
    [
      "data_meczu",
      "liga",
      "sezon",
      "gospodarz",
      "gosc",
      "rynek",
      "zakres",
      "linia",
      "kierunek",
      "status",
      "wynik",
      "wartosc_rzeczywista",
      "projekcja",
      "przewaga",
      "status_historyczny",
      "backtest_trafnosc",
      "backtest_proba",
      "proba_gospodarz",
      "proba_gosc",
      "wybrana_druzyna_id",
      "projekcja_surowa",
      "projekcja_skorygowana",
      "bukmacher",
      "kurs",
      "kurs_przeciwnej_strony",
      "czas_pobrania_kursu",
      "czas_decyzji",
      "kwalifikacja_czasu",
      "model_probability",
      "fair_odds",
      "marza_bukmachera",
      "rynek_no_vig",
      "ev_procent",
      "model_proba",
      "model_pokrycie",
      "model_wiarygodnosc",
      "status_rynku",
      "wersja_modelu",
      "kurs_zamkniecia",
      "clv_procent",
      "stawka",
      "profit",
      "notatka",
      "zrodlo",
      "utworzono",
    ],
  ];

  for (const item of items) {
    rows.push([
      item.match.kickoffAt.toISOString(),
      item.match.season.league.name,
      item.match.season.name,
      item.match.homeTeam.name,
      item.match.awayTeam.name,
      item.statLabel,
      item.scope,
      item.threshold,
      item.side,
      item.status,
      item.result,
      item.actualValue,
      item.projection,
      item.edge,
      item.evidenceStatus,
      item.backtestHitRate,
      item.backtestSignals,
      item.homeSample,
      item.awaySample,
      item.selectedTeamId,
      item.rawProjection,
      item.adjustedProjection,
      item.bookmaker,
      item.odds,
      item.oppositeOdds,
      item.quoteCapturedAt?.toISOString() ?? null,
      item.decisionAt.toISOString(),
      item.decisionTiming,
      item.modelProbability,
      item.fairOdds,
      item.bookmakerMargin,
      item.marketProbability,
      item.expectedValue,
      item.modelSample,
      item.modelCoverage,
      item.modelConfidence,
      item.marketStatus,
      item.modelVersion,
      item.closingOdds,
      selectionClv({ odds: item.odds, closingOdds: item.closingOdds }),
      item.stake,
      selectionProfit({ result: item.result, odds: item.odds, stake: item.stake }),
      item.note,
      item.source,
      item.createdAt.toISOString(),
    ]);
  }

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dziennik-decyzji.csv"',
      "Cache-Control": "no-store",
    },
  });
}
