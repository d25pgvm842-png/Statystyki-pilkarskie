import {
  buildMarketProjections,
  type AnalysisMatch,
} from "@/lib/stats/match-analysis";
import {
  runMarketBacktest,
  type BacktestBreakdown,
  type BacktestLookback,
  type BacktestMatch,
  type BacktestSide,
  type BacktestSummary,
} from "@/lib/stats/market-backtest";
import {
  trendDefinition,
  type TrendStatKey,
} from "@/lib/stats/trends";

export type ScannerEvidenceStatus =
  | "SUPPORTED"
  | "WATCH"
  | "WEAK"
  | "UNVERIFIED";

export type ScannerMatch = AnalysisMatch & {
  round?: number | null;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
};

export type ScannerCandidate = {
  matchId: string;
  kickoffAt: Date;
  round: number | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  statKey: TrendStatKey;
  statLabel: string;
  threshold: number;
  side: "OVER" | "UNDER";
  projection: number;
  edge: number;
  projectedHome: number;
  projectedAway: number;
  homeSample: number;
  awaySample: number;
  homeFor: number | null;
  awayAgainst: number | null;
  awayFor: number | null;
  homeAgainst: number | null;
  sideBacktestSignals: number;
  sideBacktestHitRate: number | null;
  edgeBacktestSignals: number;
  edgeBacktestHitRate: number | null;
  evidenceStatus: ScannerEvidenceStatus;
};

export type ScannerSummary = {
  statKey: TrendStatKey;
  statLabel: string;
  threshold: number;
  requestedSide: BacktestSide;
  lookback: BacktestLookback;
  minSample: number;
  minEdge: number;
  upcomingTotal: number;
  fullProjections: number;
  candidatesTotal: number;
  supportedCandidates: number;
  watchCandidates: number;
  weakCandidates: number;
  unverifiedCandidates: number;
  skippedMissingProjection: number;
  skippedSample: number;
  skippedNoEdge: number;
  calibration: BacktestSummary;
  candidates: ScannerCandidate[];
};

function priorVenueMatches(input: {
  matches: BacktestMatch[];
  teamId: string;
  venue: "HOME" | "AWAY";
  before: Date | string;
  lookback: BacktestLookback;
}) {
  const boundary = new Date(input.before).getTime();
  const filtered = input.matches
    .filter((match) => {
      const kickoff = new Date(match.kickoffAt).getTime();
      if (kickoff >= boundary) return false;
      return input.venue === "HOME"
        ? match.homeTeamId === input.teamId
        : match.awayTeamId === input.teamId;
    })
    .sort(
      (left, right) =>
        new Date(right.kickoffAt).getTime() - new Date(left.kickoffAt).getTime(),
    );

  return input.lookback === null
    ? filtered
    : filtered.slice(0, input.lookback);
}

function selectSide(input: {
  projection: number;
  threshold: number;
  requestedSide: BacktestSide;
  minEdge: number;
}) {
  const delta = input.projection - input.threshold;

  if (input.requestedSide === "OVER") {
    return delta >= input.minEdge ? "OVER" as const : null;
  }
  if (input.requestedSide === "UNDER") {
    return -delta >= input.minEdge ? "UNDER" as const : null;
  }
  if (delta >= input.minEdge) return "OVER" as const;
  if (-delta >= input.minEdge) return "UNDER" as const;
  return null;
}

function edgeBucketKey(edge: number) {
  if (edge < 0.5) return "0-0.49";
  if (edge < 1) return "0.5-0.99";
  if (edge < 1.5) return "1-1.49";
  if (edge < 2) return "1.5-1.99";
  return "2+";
}

function sideBreakdown(
  calibration: BacktestSummary,
  side: "OVER" | "UNDER",
): BacktestBreakdown | null {
  return calibration.sideBreakdown.find((row) => row.key === side) ?? null;
}

function edgeBreakdown(
  calibration: BacktestSummary,
  edge: number,
): BacktestBreakdown | null {
  const key = edgeBucketKey(edge);
  return calibration.edgeBreakdown.find((row) => row.key === key) ?? null;
}

export function scannerEvidenceStatus(input: {
  sideSignals: number;
  sideHitRate: number | null;
  edgeSignals: number;
  edgeHitRate: number | null;
}): ScannerEvidenceStatus {
  if (
    input.sideSignals >= 20
    && input.edgeSignals >= 8
    && input.sideHitRate !== null
    && input.edgeHitRate !== null
    && input.sideHitRate >= 55
    && input.edgeHitRate >= 55
  ) {
    return "SUPPORTED";
  }

  if (
    input.sideSignals >= 10
    && input.edgeSignals >= 5
    && input.sideHitRate !== null
    && input.edgeHitRate !== null
    && input.sideHitRate >= 50
    && input.edgeHitRate >= 50
  ) {
    return "WATCH";
  }

  if (
    input.sideSignals >= 10
    && input.sideHitRate !== null
    && input.sideHitRate < 50
  ) {
    return "WEAK";
  }

  return "UNVERIFIED";
}

function statusRank(status: ScannerEvidenceStatus) {
  if (status === "SUPPORTED") return 0;
  if (status === "WATCH") return 1;
  if (status === "UNVERIFIED") return 2;
  return 3;
}

export function scanUpcomingMarket(input: {
  finishedMatches: BacktestMatch[];
  upcomingMatches: ScannerMatch[];
  statKey: TrendStatKey;
  threshold: number;
  side: BacktestSide;
  lookback: BacktestLookback;
  minSample: number;
  minEdge: number;
}): ScannerSummary {
  const definition = trendDefinition(input.statKey);
  if (!definition) throw new Error("Nieznany rynek skanera.");

  const calibration = runMarketBacktest({
    matches: input.finishedMatches,
    statKey: input.statKey,
    threshold: input.threshold,
    side: input.side,
    lookback: input.lookback,
    minSample: input.minSample,
    minEdge: input.minEdge,
  });

  const candidates: ScannerCandidate[] = [];
  let fullProjections = 0;
  let skippedMissingProjection = 0;
  let skippedSample = 0;
  let skippedNoEdge = 0;

  const orderedUpcoming = [...input.upcomingMatches].sort(
    (left, right) =>
      new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime(),
  );

  for (const match of orderedUpcoming) {
    const homeVenue = priorVenueMatches({
      matches: input.finishedMatches,
      teamId: match.homeTeamId,
      venue: "HOME",
      before: match.kickoffAt,
      lookback: input.lookback,
    });
    const awayVenue = priorVenueMatches({
      matches: input.finishedMatches,
      teamId: match.awayTeamId,
      venue: "AWAY",
      before: match.kickoffAt,
      lookback: input.lookback,
    });

    const projection = buildMarketProjections({
      homeMatches: homeVenue,
      awayMatches: awayVenue,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
    }).find((row) => row.key === input.statKey);

    if (
      !projection
      || projection.projectedTotal === null
      || projection.projectedHome === null
      || projection.projectedAway === null
      || projection.homeProjectionQuality !== "FULL"
      || projection.awayProjectionQuality !== "FULL"
    ) {
      skippedMissingProjection += 1;
      continue;
    }
    fullProjections += 1;

    if (
      projection.homeSample < input.minSample
      || projection.awaySample < input.minSample
    ) {
      skippedSample += 1;
      continue;
    }

    const side = selectSide({
      projection: projection.projectedTotal,
      threshold: input.threshold,
      requestedSide: input.side,
      minEdge: input.minEdge,
    });
    if (!side) {
      skippedNoEdge += 1;
      continue;
    }

    const edge = Math.abs(projection.projectedTotal - input.threshold);
    const sideHistory = sideBreakdown(calibration, side);
    const edgeHistory = edgeBreakdown(calibration, edge);
    const sideSignals = sideHistory ? sideHistory.signals : 0;
    const sideHitRate = sideHistory ? sideHistory.hitRate : null;
    const edgeSignals = edgeHistory ? edgeHistory.signals : 0;
    const edgeHitRate = edgeHistory ? edgeHistory.hitRate : null;
    const evidenceStatus = scannerEvidenceStatus({
      sideSignals,
      sideHitRate,
      edgeSignals,
      edgeHitRate,
    });

    candidates.push({
      matchId: match.id,
      kickoffAt: new Date(match.kickoffAt),
      round: match.round ?? null,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeTeamName: match.homeTeam.name,
      awayTeamName: match.awayTeam.name,
      statKey: input.statKey,
      statLabel: definition.label,
      threshold: input.threshold,
      side,
      projection: projection.projectedTotal,
      edge,
      projectedHome: projection.projectedHome,
      projectedAway: projection.projectedAway,
      homeSample: projection.homeSample,
      awaySample: projection.awaySample,
      homeFor: projection.homeFor,
      awayAgainst: projection.awayAgainst,
      awayFor: projection.awayFor,
      homeAgainst: projection.homeAgainst,
      sideBacktestSignals: sideSignals,
      sideBacktestHitRate: sideHitRate,
      edgeBacktestSignals: edgeSignals,
      edgeBacktestHitRate: edgeHitRate,
      evidenceStatus,
    });
  }

  candidates.sort(
    (left, right) =>
      statusRank(left.evidenceStatus) - statusRank(right.evidenceStatus)
      || right.edge - left.edge
      || left.kickoffAt.getTime() - right.kickoffAt.getTime(),
  );

  return {
    statKey: input.statKey,
    statLabel: definition.label,
    threshold: input.threshold,
    requestedSide: input.side,
    lookback: input.lookback,
    minSample: input.minSample,
    minEdge: input.minEdge,
    upcomingTotal: orderedUpcoming.length,
    fullProjections,
    candidatesTotal: candidates.length,
    supportedCandidates: candidates.filter((row) => row.evidenceStatus === "SUPPORTED").length,
    watchCandidates: candidates.filter((row) => row.evidenceStatus === "WATCH").length,
    weakCandidates: candidates.filter((row) => row.evidenceStatus === "WEAK").length,
    unverifiedCandidates: candidates.filter((row) => row.evidenceStatus === "UNVERIFIED").length,
    skippedMissingProjection,
    skippedSample,
    skippedNoEdge,
    calibration,
    candidates,
  };
}

export function scannerEvidenceLabel(status: ScannerEvidenceStatus) {
  if (status === "SUPPORTED") return "wsparte historią";
  if (status === "WATCH") return "do obserwacji";
  if (status === "WEAK") return "słaba historia";
  return "niezweryfikowane";
}
