import { requireUser } from "@/lib/auth";
import { loadAnalysisJournal } from "@/lib/data/analysis-journal";
import {
  selectionClv,
  selectionProfit,
} from "@/lib/stats/analysis-journal";
import { TREND_STAT_DEFINITIONS } from "@/lib/stats/trends";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const seasonId = url.searchParams.get("seasonId");
  const statusParam = url.searchParams.get("status");
  const status = ["WATCHING", "PLAYED", "REJECTED", "SETTLED", "VOID"].includes(statusParam ?? "")
    ? statusParam
    : null;
  const statParam = url.searchParams.get("statKey");
  const statKey = TREND_STAT_DEFINITIONS.some((item) => item.key === statParam)
    ? statParam
    : null;

  const { items, metrics } = await loadAnalysisJournal({
    userId: user.id,
    seasonId,
    status,
    statKey,
  });

  const rows: unknown[][] = [
    ["metryka", "wartosc"],
    ["obserwowane", metrics.watching],
    ["zagrane_otwarte", metrics.playedOpen],
    ["rozliczone", metrics.settled],
    ["trafnosc_procent", metrics.hitRate],
    ["obrot", metrics.turnover],
    ["profit", metrics.profit],
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
      "bukmacher",
      "kurs",
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
      item.bookmaker,
      item.odds,
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
