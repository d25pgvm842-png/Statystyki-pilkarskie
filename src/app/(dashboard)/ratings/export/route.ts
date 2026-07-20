import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadMarketRatings } from "@/lib/data/market-ratings";
import {
  marketRatingQualityLabel,
  marketStrengthBucketLabel,
  type RatingLookback,
  type RatingScope,
  type RatingVenue,
  type StrengthBucket,
} from "@/lib/stats/market-ratings";
import {
  TREND_STAT_DEFINITIONS,
  type TrendStatKey,
} from "@/lib/stats/trends";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function lookback(value: string | null): RatingLookback {
  if (value === "5" || value === "10" || value === "20") return Number(value) as 5 | 10 | 20;
  return value === "all" ? null : 10;
}

function strengthBucket(value: string | null): StrengthBucket | null {
  if (value === "1" || value === "2" || value === "3" || value === "4") {
    return Number(value) as StrengthBucket;
  }
  return null;
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
  const requestedScope = url.searchParams.get("scope") ?? "";
  const scope = ["TEAM_FOR", "TEAM_AGAINST", "MATCH_TOTAL"].includes(requestedScope)
    ? requestedScope as RatingScope
    : "TEAM_FOR";
  const requestedVenue = url.searchParams.get("venue") ?? "";
  const venue = ["ALL", "HOME", "AWAY"].includes(requestedVenue)
    ? requestedVenue as RatingVenue
    : "ALL";
  const minSample = [1, 3, 5, 10].includes(Number(url.searchParams.get("minSample")))
    ? Number(url.searchParams.get("minSample"))
    : 3;
  const selectedBucket = strengthBucket(url.searchParams.get("bucket"));

  const loaded = await loadMarketRatings({
    seasonId,
    statKey,
    scope,
    venue,
    lookback: lookback(url.searchParams.get("lookback")),
    minSample,
  });
  if (!loaded) notFound();

  const rows: unknown[][] = [[
    "pozycja",
    "druzyna",
    "rynek",
    "zakres",
    "miejsce",
    "proba",
    "srednia",
    "mediana",
    "minimum",
    "maksimum",
    "srednia_ligi",
    "roznica_do_ligi",
    "roznica_procent",
    "percentyl",
    "rating_0_100",
    "koszyk_1_4",
    "opis_koszyka",
    "jakosc_proby",
    "regula_koszykow",
  ]];

  for (const row of loaded.ratings.rows) {
    if (selectedBucket !== null && row.strengthBucket !== selectedBucket) continue;

    rows.push([
      row.position,
      row.teamName,
      loaded.ratings.statLabel,
      scope,
      venue,
      row.sample,
      row.average,
      row.median,
      row.min,
      row.max,
      row.leagueAverage,
      row.delta,
      row.deltaPercent,
      row.percentile,
      row.rating,
      row.strengthBucket,
      marketStrengthBucketLabel(row.strengthBucket),
      marketRatingQualityLabel(row.quality),
      loaded.ratings.bucketRule,
    ]);
  }

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
  const safeLeague = loaded.season.league.code.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const safeSeason = loaded.season.name.replace(/[^a-zA-Z0-9]+/g, "-");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="koszyki-${safeLeague}-${safeSeason}-${statKey}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
