import {
  buildOpponentStrengthProfile,
} from "@/lib/stats/opponent-strength";
import type {
  RatingLookback,
  RatingMatch,
  RatingTeam,
} from "@/lib/stats/market-ratings";
import {
  extractTrendValues,
  trendDefinition,
  type TrendStatKey,
} from "@/lib/stats/trends";

export const MARKET_WORKSHOP_MODEL_VERSION = "market-workshop-v1.0";

export type MarketWorkshopTarget = "MATCH_TOTAL" | "HOME_TEAM" | "AWAY_TEAM";
export type MarketWorkshopSide = "OVER" | "UNDER";
export type MarketWorkshopConfidence = "NO_DATA" | "WEAK" | "LIMITED" | "MEDIUM" | "STRONG";
export type MarketWorkshopStatus =
  | "INSUFFICIENT_DATA"
  | "NO_ODDS"
  | "NO_EDGE"
  | "WATCH"
  | "POTENTIAL_VALUE";

export type MarketWorkshopSideResult = {
  side: MarketWorkshopSide;
  modelProbability: number | null;
  fairOdds: number | null;
  bookmakerOdds: number | null;
  impliedProbability: number | null;
  marketProbability: number | null;
  modelVsMarket: number | null;
  expectedValue: number | null;
  status: MarketWorkshopStatus;
};

export type MarketWorkshopResult = {
  statKey: TrendStatKey;
  statLabel: string;
  target: MarketWorkshopTarget;
  selectedTeamId: string | null;
  line: number;
  rawProjection: number | null;
  adjustedProjection: number | null;
  projection: number | null;
  effectiveSample: number;
  homeSample: number;
  awaySample: number;
  coverage: number;
  confidence: MarketWorkshopConfidence;
  distributionSize: number;
  overCount: number;
  underCount: number;
  bookmakerMargin: number | null;
  modelVersion: string;
  sides: Record<MarketWorkshopSide, MarketWorkshopSideResult>;
};

type TeamDistribution = {
  values: number[];
  rawProjection: number | null;
  adjustedProjection: number | null;
  effectiveSample: number;
  componentSamples: [number, number];
  coverage: number;
};

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function optionalAverage(values: Array<number | null>) {
  return average(values.filter((value): value is number => value !== null));
}

function finiteOdds(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 1 ? value : null;
}

export function isHalfLine(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 500) return false;
  const doubled = Math.round(value * 2);
  return Math.abs(value * 2 - doubled) < 1e-9 && Math.abs(doubled % 2) === 1;
}

export function impliedProbability(odds: number | null | undefined) {
  const valid = finiteOdds(odds);
  return valid === null ? null : (1 / valid) * 100;
}

export function fairOdds(probabilityPercent: number | null | undefined) {
  if (
    probabilityPercent === null
    || probabilityPercent === undefined
    || !Number.isFinite(probabilityPercent)
    || probabilityPercent <= 0
    || probabilityPercent >= 100
  ) return null;
  return 100 / probabilityPercent;
}

export function expectedValue(
  probabilityPercent: number | null | undefined,
  odds: number | null | undefined,
) {
  const validOdds = finiteOdds(odds);
  if (
    validOdds === null
    || probabilityPercent === null
    || probabilityPercent === undefined
    || !Number.isFinite(probabilityPercent)
    || probabilityPercent < 0
    || probabilityPercent > 100
  ) return null;
  return ((probabilityPercent / 100) * validOdds - 1) * 100;
}

export function removeMarketMargin(
  overOdds: number | null | undefined,
  underOdds: number | null | undefined,
) {
  const overImplied = impliedProbability(overOdds);
  const underImplied = impliedProbability(underOdds);
  if (overImplied === null || underImplied === null) {
    return {
      margin: null,
      overProbability: null,
      underProbability: null,
    };
  }

  const total = overImplied + underImplied;
  return {
    margin: total - 100,
    overProbability: (overImplied / total) * 100,
    underProbability: (underImplied / total) * 100,
  };
}

export function betaSmoothedProbability(input: {
  rawRate: number | null;
  effectiveSample: number;
}) {
  if (input.rawRate === null || input.effectiveSample <= 0) return null;
  const successes = input.rawRate * input.effectiveSample;
  return ((successes + 1) / (input.effectiveSample + 2)) * 100;
}

function confidenceFor(sample: number, coverage: number): MarketWorkshopConfidence {
  let confidence: MarketWorkshopConfidence;
  if (sample <= 0) confidence = "NO_DATA";
  else if (sample < 5) confidence = "WEAK";
  else if (sample < 10) confidence = "LIMITED";
  else if (sample < 20) confidence = "MEDIUM";
  else confidence = "STRONG";

  if (coverage >= 100) return confidence;
  if (confidence === "STRONG") return "MEDIUM";
  if (confidence === "MEDIUM") return "LIMITED";
  if (confidence === "LIMITED") return "WEAK";
  return confidence;
}

export function marketWorkshopStatus(input: {
  modelProbability: number | null;
  odds: number | null;
  expectedValue: number | null;
  modelVsMarket: number | null;
  effectiveSample: number;
  coverage: number;
  confidence: MarketWorkshopConfidence;
}): MarketWorkshopStatus {
  if (input.modelProbability === null || input.effectiveSample <= 0) return "INSUFFICIENT_DATA";
  if (input.odds === null || input.expectedValue === null) return "NO_ODDS";

  const reliable =
    input.effectiveSample >= 10
    && input.coverage >= 70
    && (input.confidence === "MEDIUM" || input.confidence === "STRONG")
    && input.modelVsMarket !== null
    && input.modelVsMarket >= 3;

  if (input.expectedValue >= 5 && reliable) return "POTENTIAL_VALUE";
  if (input.expectedValue >= 2) return "WATCH";
  return "NO_EDGE";
}

function sampled(values: number[], maximum = 80) {
  if (values.length <= maximum) return values;
  const ordered = [...values].sort((left, right) => left - right);
  const result: number[] = [];
  for (let index = 0; index < maximum; index += 1) {
    const sourceIndex = Math.floor((index * ordered.length) / maximum);
    result.push(ordered[sourceIndex]);
  }
  return result;
}

function combineByAverage(left: number[], right: number[]) {
  if (!left.length) return [...right];
  if (!right.length) return [...left];
  const result: number[] = [];
  for (const leftValue of sampled(left)) {
    for (const rightValue of sampled(right)) {
      result.push((leftValue + rightValue) / 2);
    }
  }
  return sampled(result);
}

function combineBySum(left: number[], right: number[]) {
  if (!left.length || !right.length) return [];
  const result: number[] = [];
  for (const leftValue of sampled(left)) {
    for (const rightValue of sampled(right)) {
      result.push(leftValue + rightValue);
    }
  }
  return sampled(result, 160);
}

function shifted(values: number[], targetAverage: number | null) {
  const sourceAverage = average(values);
  if (!values.length || sourceAverage === null || targetAverage === null) return [...values];
  const delta = targetAverage - sourceAverage;
  return values.map((value) => Math.max(0, value + delta));
}

function teamDistribution(input: {
  teams: RatingTeam[];
  matches: RatingMatch[];
  statKey: TrendStatKey;
  teamId: string;
  opponentId: string;
  venue: "HOME" | "AWAY";
  lookback: RatingLookback;
  minSample: number;
  before: Date | string;
}) : TeamDistribution {
  const opponentVenue = input.venue === "HOME" ? "AWAY" : "HOME";
  const forValues = extractTrendValues(input.matches, {
    statKey: input.statKey,
    scope: "TEAM_FOR",
    teamId: input.teamId,
    venue: input.venue,
    limit: input.lookback,
  }).map((item) => item.value);
  const againstValues = extractTrendValues(input.matches, {
    statKey: input.statKey,
    scope: "TEAM_AGAINST",
    teamId: input.opponentId,
    venue: opponentVenue,
    limit: input.lookback,
  }).map((item) => item.value);

  const teamProfile = buildOpponentStrengthProfile({
    teams: input.teams,
    matches: input.matches,
    teamId: input.teamId,
    statKey: input.statKey,
    scope: "TEAM_FOR",
    venue: input.venue,
    lookback: input.lookback,
    minSample: input.minSample,
    before: input.before,
    currentOpponentId: input.opponentId,
  });
  const opponentProfile = buildOpponentStrengthProfile({
    teams: input.teams,
    matches: input.matches,
    teamId: input.opponentId,
    statKey: input.statKey,
    scope: "TEAM_AGAINST",
    venue: opponentVenue,
    lookback: input.lookback,
    minSample: input.minSample,
    before: input.before,
    currentOpponentId: input.teamId,
  });

  const rawValues = combineByAverage(forValues, againstValues);
  const rawProjection = average(rawValues);
  const adjustedProjection = optionalAverage([
    teamProfile.adjustedAverage ?? teamProfile.rawAverage,
    opponentProfile.adjustedAverage ?? opponentProfile.rawAverage,
  ]);
  const presentComponents = Number(forValues.length > 0) + Number(againstValues.length > 0);
  const effectiveSample = presentComponents === 2
    ? Math.min(forValues.length, againstValues.length)
    : Math.max(forValues.length, againstValues.length);

  return {
    values: shifted(rawValues, adjustedProjection),
    rawProjection,
    adjustedProjection,
    effectiveSample,
    componentSamples: [forValues.length, againstValues.length],
    coverage: presentComponents * 50,
  };
}

export function buildMarketWorkshop(input: {
  teams: RatingTeam[];
  matches: RatingMatch[];
  statKey: TrendStatKey;
  target: MarketWorkshopTarget;
  line: number;
  homeTeamId: string;
  awayTeamId: string;
  lookback: RatingLookback;
  minSample?: number;
  before: Date | string;
  overOdds?: number | null;
  underOdds?: number | null;
}): MarketWorkshopResult {
  const definition = trendDefinition(input.statKey);
  if (!definition) throw new Error("Nieznany rynek warsztatu.");
  if (!isHalfLine(input.line)) throw new Error("Warsztat v1 obsługuje wyłącznie linie połówkowe.");

  const minSample = Math.max(1, Math.floor(input.minSample ?? 3));
  const beforeTime = new Date(input.before).getTime();
  const availableMatches = input.matches.filter(
    (match) => new Date(match.kickoffAt).getTime() < beforeTime,
  );
  const home = teamDistribution({
    ...input,
    matches: availableMatches,
    teamId: input.homeTeamId,
    opponentId: input.awayTeamId,
    venue: "HOME",
    minSample,
  });
  const away = teamDistribution({
    ...input,
    matches: availableMatches,
    teamId: input.awayTeamId,
    opponentId: input.homeTeamId,
    venue: "AWAY",
    minSample,
  });

  let selectedTeamId: string | null = null;
  let values: number[] = [];
  let rawProjection: number | null = null;
  let adjustedProjection: number | null = null;
  let effectiveSample = 0;
  let coverage = 0;
  let homeSample = home.effectiveSample;
  let awaySample = away.effectiveSample;

  if (input.target === "HOME_TEAM") {
    selectedTeamId = input.homeTeamId;
    values = home.values;
    rawProjection = home.rawProjection;
    adjustedProjection = home.adjustedProjection;
    effectiveSample = home.effectiveSample;
    coverage = home.coverage;
    homeSample = home.componentSamples[0];
    awaySample = home.componentSamples[1];
  } else if (input.target === "AWAY_TEAM") {
    selectedTeamId = input.awayTeamId;
    values = away.values;
    rawProjection = away.rawProjection;
    adjustedProjection = away.adjustedProjection;
    effectiveSample = away.effectiveSample;
    coverage = away.coverage;
    homeSample = away.componentSamples[1];
    awaySample = away.componentSamples[0];
  } else {
    values = combineBySum(home.values, away.values);
    rawProjection = home.rawProjection !== null && away.rawProjection !== null
      ? home.rawProjection + away.rawProjection
      : null;
    adjustedProjection = home.adjustedProjection !== null && away.adjustedProjection !== null
      ? home.adjustedProjection + away.adjustedProjection
      : null;
    effectiveSample = home.effectiveSample > 0 && away.effectiveSample > 0
      ? Math.min(home.effectiveSample, away.effectiveSample)
      : 0;
    coverage = (home.coverage + away.coverage) / 2;
  }

  const overCount = values.filter((value) => value > input.line).length;
  const underCount = values.filter((value) => value < input.line).length;
  const classified = overCount + underCount;
  const rawOverRate = classified ? overCount / classified : null;
  const overProbability = betaSmoothedProbability({
    rawRate: rawOverRate,
    effectiveSample,
  });
  const underProbability = overProbability === null ? null : 100 - overProbability;
  const market = removeMarketMargin(input.overOdds, input.underOdds);
  const confidence = confidenceFor(effectiveSample, coverage);

  const side = (
    sideName: MarketWorkshopSide,
    probability: number | null,
    odds: number | null | undefined,
    marketProbability: number | null,
  ): MarketWorkshopSideResult => {
    const validOdds = finiteOdds(odds);
    const ev = expectedValue(probability, validOdds);
    const difference = probability !== null && marketProbability !== null
      ? probability - marketProbability
      : null;
    return {
      side: sideName,
      modelProbability: probability,
      fairOdds: fairOdds(probability),
      bookmakerOdds: validOdds,
      impliedProbability: impliedProbability(validOdds),
      marketProbability,
      modelVsMarket: difference,
      expectedValue: ev,
      status: marketWorkshopStatus({
        modelProbability: probability,
        odds: validOdds,
        expectedValue: ev,
        modelVsMarket: difference,
        effectiveSample,
        coverage,
        confidence,
      }),
    };
  };

  return {
    statKey: input.statKey,
    statLabel: definition.label,
    target: input.target,
    selectedTeamId,
    line: input.line,
    rawProjection,
    adjustedProjection,
    projection: adjustedProjection ?? rawProjection,
    effectiveSample,
    homeSample,
    awaySample,
    coverage,
    confidence,
    distributionSize: classified,
    overCount,
    underCount,
    bookmakerMargin: market.margin,
    modelVersion: MARKET_WORKSHOP_MODEL_VERSION,
    sides: {
      OVER: side("OVER", overProbability, input.overOdds, market.overProbability),
      UNDER: side("UNDER", underProbability, input.underOdds, market.underProbability),
    },
  };
}

export function marketWorkshopConfidenceLabel(value: MarketWorkshopConfidence) {
  if (value === "STRONG") return "mocna";
  if (value === "MEDIUM") return "średnia";
  if (value === "LIMITED") return "ograniczona";
  if (value === "WEAK") return "słaba";
  return "brak danych";
}

export function marketWorkshopStatusLabel(value: MarketWorkshopStatus) {
  if (value === "POTENTIAL_VALUE") return "potencjalne value";
  if (value === "WATCH") return "obserwacja";
  if (value === "NO_EDGE") return "brak przewagi";
  if (value === "NO_ODDS") return "brak kursu";
  return "niewystarczające dane";
}

export function marketWorkshopTargetLabel(
  value: MarketWorkshopTarget,
  homeName?: string,
  awayName?: string,
) {
  if (value === "HOME_TEAM") return `Suma drużyny: ${homeName ?? "gospodarz"}`;
  if (value === "AWAY_TEAM") return `Suma drużyny: ${awayName ?? "gość"}`;
  return "Suma meczu";
}
