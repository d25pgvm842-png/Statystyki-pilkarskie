import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadTeamOpponentStrength } from "@/lib/data/opponent-strength";
import type {
  RatingLookback,
  RatingScope,
  RatingVenue,
} from "@/lib/stats/market-ratings";
import { marketStrengthBucketLabel } from "@/lib/stats/market-ratings";
import { TREND_STAT_DEFINITIONS, type TrendStatKey } from "@/lib/stats/trends";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function lookback(value: string | null): RatingLookback {
  if (value === "5" || value === "10" || value === "20") return Number(value) as 5 | 10 | 20;
  return value === "all" ? null : 10;
}

function statKey(value: string | null): TrendStatKey {
  return TREND_STAT_DEFINITIONS.some((item) => item.key === value)
    ? value as TrendStatKey
    : "corners";
}

function scope(value: string | null): RatingScope {
  return ["TEAM_FOR", "TEAM_AGAINST", "MATCH_TOTAL"].includes(value ?? "")
    ? value as RatingScope
    : "TEAM_FOR";
}

function venue(value: string | null): RatingVenue {
  return ["ALL", "HOME", "AWAY"].includes(value ?? "")
    ? value as RatingVenue
    : "ALL";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await context.params;
  const url = new URL(request.url);
  const seasonId = url.searchParams.get("seasonId") ?? "";
  if (!seasonId) notFound();

  const loaded = await loadTeamOpponentStrength({
    seasonId,
    teamId: id,
    statKey: statKey(url.searchParams.get("statKey")),
    scope: scope(url.searchParams.get("scope")),
    venue: venue(url.searchParams.get("venue")),
    lookback: lookback(url.searchParams.get("lookback")),
    minSample: 3,
  });
  if (!loaded) notFound();

  const report = loaded.report;
  const rows: unknown[][] = [
    ["STATYSTYKI PRZECIW SILE RYWALI"],
    ["druzyna", loaded.team.name],
    ["liga", loaded.season.league.name],
    ["sezon", loaded.season.name],
    ["rynek", report.statLabel],
    ["zakres", report.scope],
    ["miejsce", report.venue],
    ["proba", report.sample],
    ["proba_porownywalna", report.comparableSample],
    ["srednia_surowa", report.rawAverage],
    ["srednia_oczekiwana", report.expectedAverage],
    ["srednia_ligi", report.leagueAverage],
    ["korekta", report.adjustment],
    ["srednia_skorygowana", report.adjustedAverage],
    [],
    ["KOSZYKI"],
    ["koszyk", "opis", "mecze", "porownywalne", "srednia_surowa", "oczekiwana", "roznica"],
  ];

  for (const bucket of report.byBucket) {
    rows.push([
      bucket.bucket,
      marketStrengthBucketLabel(bucket.bucket),
      bucket.matches,
      bucket.comparableMatches,
      bucket.rawAverage,
      bucket.expectedAverage,
      bucket.deltaAverage,
    ]);
  }

  rows.push([]);
  rows.push(["MECZE"]);
  rows.push(["data", "rywal", "miejsce", "koszyk_rywala", "rating_rywala", "proba_rywala", "wynik", "oczekiwanie", "roznica", "proba_bazowa"]);
  for (const row of report.rows) {
    rows.push([
      row.kickoffAt.toISOString(),
      row.opponentName,
      row.venue,
      row.opponentBucket,
      row.opponentRating,
      row.opponentSample,
      row.actual,
      row.expected,
      row.delta,
      row.baselineSample,
    ]);
  }

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="statystyki-przeciw-sile-rywali.csv"',
      "Cache-Control": "no-store",
    },
  });
}
