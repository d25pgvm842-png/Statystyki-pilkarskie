import assert from "node:assert/strict";
import test from "node:test";
import {
  betaSmoothedProbability,
  buildMarketWorkshop,
  expectedValue,
  fairOdds,
  impliedProbability,
  isHalfLine,
  marketWorkshopStatus,
  removeMarketMargin,
} from "@/lib/stats/market-workshop";
import type { RatingMatch } from "@/lib/stats/market-ratings";

test("warsztat akceptuje linie połówkowe i odrzuca całkowite", () => {
  assert.equal(isHalfLine(9.5), true);
  assert.equal(isHalfLine(10), false);
  assert.equal(isHalfLine(10.25), false);
});

test("kurs fair odpowiada prawdopodobieństwu modelu", () => {
  assert.equal(fairOdds(50), 2);
  assert.equal(fairOdds(40), 2.5);
  assert.equal(fairOdds(null), null);
});

test("marża i no-vig są liczone z obu kursów", () => {
  const result = removeMarketMargin(1.91, 1.91);
  assert.ok(result.margin !== null && result.margin > 4.7 && result.margin < 4.8);
  assert.ok(result.overProbability !== null && Math.abs(result.overProbability - 50) < 1e-9);
  assert.ok(result.underProbability !== null && Math.abs(result.underProbability - 50) < 1e-9);
});

test("EV korzysta z prawdopodobieństwa modelu i kursu dziesiętnego", () => {
  assert.ok(Math.abs((expectedValue(60, 2) ?? 0) - 20) < 1e-9);
  assert.equal(expectedValue(60, null), null);
  assert.equal(impliedProbability(2), 50);
});

test("wygładzenie Beta nie pozwala małej próbie dać 100 procent", () => {
  const probability = betaSmoothedProbability({ rawRate: 1, effectiveSample: 2 });
  assert.equal(probability, 75);
});


test("mała próba blokuje status potencjalnego value", () => {
  const status = marketWorkshopStatus({
    modelProbability: 70,
    odds: 2,
    expectedValue: 40,
    modelVsMarket: 20,
    effectiveSample: 4,
    coverage: 100,
    confidence: "WEAK",
  });
  assert.equal(status, "WATCH");
});

test("status value wymaga jednocześnie EV, próby, pokrycia i przewagi nad rynkiem", () => {
  const status = marketWorkshopStatus({
    modelProbability: 58,
    odds: 2,
    expectedValue: 16,
    modelVsMarket: 8,
    effectiveSample: 12,
    coverage: 100,
    confidence: "MEDIUM",
  });
  assert.equal(status, "POTENTIAL_VALUE");
});


test("silnik nie używa meczów z przyszłości i nie zamienia braków na zero", () => {
  const teams = [
    { id: "A", name: "Alpha" },
    { id: "B", name: "Beta" },
    { id: "C", name: "Gamma" },
    { id: "D", name: "Delta" },
  ];
  const matches: RatingMatch[] = [
    {
      id: "past-home",
      kickoffAt: new Date("2026-01-01T12:00:00.000Z"),
      homeTeamId: "A",
      awayTeamId: "D",
      stats: { homeCorners: 4, awayCorners: 3 },
    },
    {
      id: "past-away",
      kickoffAt: new Date("2026-01-02T12:00:00.000Z"),
      homeTeamId: "C",
      awayTeamId: "B",
      stats: { homeCorners: 4, awayCorners: 3 },
    },
    {
      id: "missing-unrelated",
      kickoffAt: new Date("2026-01-03T12:00:00.000Z"),
      homeTeamId: "C",
      awayTeamId: "D",
      stats: null,
    },
    {
      id: "future-home",
      kickoffAt: new Date("2026-02-01T12:00:00.000Z"),
      homeTeamId: "A",
      awayTeamId: "D",
      stats: { homeCorners: 100, awayCorners: 100 },
    },
    {
      id: "future-away",
      kickoffAt: new Date("2026-02-02T12:00:00.000Z"),
      homeTeamId: "C",
      awayTeamId: "B",
      stats: { homeCorners: 100, awayCorners: 100 },
    },
  ];

  const result = buildMarketWorkshop({
    teams,
    matches,
    statKey: "corners",
    target: "MATCH_TOTAL",
    line: 7.5,
    homeTeamId: "A",
    awayTeamId: "B",
    lookback: null,
    minSample: 1,
    before: new Date("2026-01-15T12:00:00.000Z"),
    overOdds: 2,
    underOdds: 2,
  });

  assert.equal(result.rawProjection, 7);
  assert.equal(result.homeSample, 1);
  assert.equal(result.awaySample, 1);
  assert.equal(result.distributionSize, 1);
});
