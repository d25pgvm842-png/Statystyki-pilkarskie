import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadMarketScanner } from "@/lib/data/market-scanner";
import { scannerEvidenceLabel } from "@/lib/stats/market-scanner";
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
  const days = [3, 7, 14, 30, 60].includes(Number(url.searchParams.get("days")))
    ? Number(url.searchParams.get("days"))
    : 14;
  const status = url.searchParams.get("status") ?? "ALL";

  const loaded = await loadMarketScanner({
    seasonId,
    statKey,
    threshold: finite(url.searchParams.get("threshold"), 9.5),
    side,
    lookback: lookback(url.searchParams.get("lookback")),
    minSample,
    minEdge: finite(url.searchParams.get("minEdge"), 0.5),
    days,
  });
  if (!loaded) notFound();

  const rows: unknown[][] = [[
    "data",
    "kolejka",
    "gospodarz",
    "gosc",
    "rynek",
    "linia",
    "sygnal",
    "projekcja",
    "przewaga",
    "projekcja_gospodarz",
    "projekcja_gosc",
    "proba_gospodarz",
    "proba_gosc",
    "trafnosc_kierunku",
    "sygnaly_kierunku",
    "trafnosc_przewagi",
    "sygnaly_przewagi",
    "status_historyczny",
  ]];

  for (const row of loaded.summary.candidates) {
    if (status !== "ALL" && row.evidenceStatus !== status) continue;
    rows.push([
      row.kickoffAt.toISOString(),
      row.round,
      row.homeTeamName,
      row.awayTeamName,
      row.statLabel,
      row.threshold,
      row.side,
      row.projection,
      row.edge,
      row.projectedHome,
      row.projectedAway,
      row.homeSample,
      row.awaySample,
      row.sideBacktestHitRate,
      row.sideBacktestSignals,
      row.edgeBacktestHitRate,
      row.edgeBacktestSignals,
      scannerEvidenceLabel(row.evidenceStatus),
    ]);
  }

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
  const safeLeague = loaded.season.league.code.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const safeSeason = loaded.season.name.replace(/[^a-zA-Z0-9]+/g, "-");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="skaner-${safeLeague}-${safeSeason}-${statKey}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
