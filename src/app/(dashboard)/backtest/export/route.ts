import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadMarketBacktest } from "@/lib/data/market-backtest";
import {
  type BacktestLookback,
  type BacktestSide,
} from "@/lib/stats/market-backtest";
import {
  TREND_STAT_DEFINITIONS,
  type TrendStatKey,
} from "@/lib/stats/trends";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function lookback(value: string | null): BacktestLookback {
  if (value === "5" || value === "10" || value === "20") {
    return Number(value) as 5 | 10 | 20;
  }
  return value === "all" ? null : 10;
}

function finite(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  await requireUser();
  const url = new URL(request.url);
  const seasonId = url.searchParams.get("seasonId") ?? "";
  if (!seasonId) notFound();

  const requestedStat = url.searchParams.get("statKey") ?? "";
  const statKey = TREND_STAT_DEFINITIONS.some((item) => item.key === requestedStat)
    ? requestedStat as TrendStatKey
    : "corners";
  const requestedSide = url.searchParams.get("side") ?? "";
  const side = ["OVER", "UNDER", "BOTH"].includes(requestedSide)
    ? requestedSide as BacktestSide
    : "BOTH";
  const minSample = [1, 2, 3, 5, 10].includes(Number(url.searchParams.get("minSample")))
    ? Number(url.searchParams.get("minSample"))
    : 3;

  const loaded = await loadMarketBacktest({
    seasonId,
    statKey,
    threshold: finite(url.searchParams.get("threshold"), 9.5),
    side,
    lookback: lookback(url.searchParams.get("lookback")),
    minSample,
    minEdge: finite(url.searchParams.get("minEdge"), 0.5),
  });
  if (!loaded) notFound();

  const summaryRows: unknown[][] = [
    ["metryka", "wartosc"],
    ["liga", loaded.season.league.name],
    ["sezon", loaded.season.name],
    ["rynek", loaded.summary.statLabel],
    ["linia", loaded.summary.threshold],
    ["kierunek", loaded.summary.requestedSide],
    ["lookback", loaded.summary.lookback ?? "all"],
    ["minimalna_proba", loaded.summary.minSample],
    ["minimalna_przewaga", loaded.summary.minEdge],
    ["sygnaly", loaded.summary.signals],
    ["trafione", loaded.summary.wins],
    ["nietrafione", loaded.summary.losses],
    ["push", loaded.summary.pushes],
    ["trafnosc_procent", loaded.summary.hitRate],
    ["pokrycie_procent", loaded.summary.coverage],
    ["srednia_przewaga", loaded.summary.averageEdge],
    ["mae", loaded.summary.meanAbsoluteError],
    ["bias", loaded.summary.bias],
  ];

  const signalRows: unknown[][] = [[
    "data",
    "kolejka",
    "gospodarz",
    "gosc",
    "sygnal",
    "projekcja",
    "linia",
    "przewaga",
    "wynik_statystyczny",
    "ocena",
    "proba_gospodarz",
    "proba_gosc",
    "gospodarz_wykonuje",
    "gosc_oddaje",
    "gosc_wykonuje",
    "gospodarz_oddaje",
  ]];

  for (const row of loaded.summary.signalsRows) {
    signalRows.push([
      row.kickoffAt.toISOString(),
      row.round,
      row.homeTeamName,
      row.awayTeamName,
      row.side,
      row.projection,
      row.threshold,
      row.edge,
      row.actual,
      row.result,
      row.homeSample,
      row.awaySample,
      row.homeFor,
      row.awayAgainst,
      row.awayFor,
      row.homeAgainst,
    ]);
  }

  const csv = `\uFEFF${[
    ...summaryRows.map((row) => row.map(csvCell).join(";")),
    "",
    ...signalRows.map((row) => row.map(csvCell).join(";")),
  ].join("\r\n")}\r\n`;
  const safeLeague = loaded.season.league.code.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const safeSeason = loaded.season.name.replace(/[^a-zA-Z0-9]+/g, "-");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="backtest-${safeLeague}-${safeSeason}-${statKey}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
