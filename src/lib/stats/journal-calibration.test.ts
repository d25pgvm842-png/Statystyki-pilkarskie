import assert from "node:assert/strict";
import test from "node:test";
import {
  expectedValueCalibrationBucket,
  probabilityCalibrationBucket,
  summarizeCalibration,
  summarizeJournalCalibration,
  type CalibrationEntry,
} from "@/lib/stats/journal-calibration";

function entry(input: Partial<CalibrationEntry> = {}): CalibrationEntry {
  return {
    status: "SETTLED",
    result: "WIN",
    odds: 2,
    stake: 100,
    modelProbability: 60,
    expectedValue: 20,
    modelVersion: "model-v1",
    leagueId: "pl",
    leagueName: "Ekstraklasa",
    statKey: "corners",
    statLabel: "Rzuty rożne",
    side: "OVER",
    ...input,
  };
}

test("Brier Score i luka kalibracji korzystają wyłącznie z WIN/LOSS", () => {
  const summary = summarizeCalibration([
    entry({ result: "WIN", modelProbability: 60 }),
    entry({ result: "LOSS", modelProbability: 60 }),
    entry({ result: "PUSH", modelProbability: 90 }),
    entry({ status: "VOID", result: "VOID", modelProbability: 90 }),
  ]);

  assert.equal(summary.resolvedEntries, 2);
  assert.equal(summary.wins, 1);
  assert.equal(summary.losses, 1);
  assert.equal(summary.averageModelProbability, 60);
  assert.equal(summary.actualHitRate, 50);
  assert.equal(summary.calibrationGap, -10);
  assert.ok(summary.brierScore !== null);
  assert.ok(Math.abs(summary.brierScore - 0.26) < 1e-12);
});

test("stare wpisy bez snapshotu nie tworzą zerowej kalibracji", () => {
  const summary = summarizeCalibration([
    entry({ modelProbability: null, expectedValue: null, modelVersion: null }),
  ]);

  assert.equal(summary.totalEntries, 1);
  assert.equal(summary.snapshotEntries, 0);
  assert.equal(summary.snapshotCoverage, 0);
  assert.equal(summary.resolvedEntries, 0);
  assert.equal(summary.actualHitRate, null);
  assert.equal(summary.brierScore, null);
  assert.equal(summary.roi, null);
});

test("granice koszyków prawdopodobieństwa są jednoznaczne", () => {
  assert.equal(probabilityCalibrationBucket(49.99).key, "lt50");
  assert.equal(probabilityCalibrationBucket(50).key, "50_55");
  assert.equal(probabilityCalibrationBucket(55).key, "55_60");
  assert.equal(probabilityCalibrationBucket(60).key, "60_65");
  assert.equal(probabilityCalibrationBucket(65).key, "65_plus");
});

test("granice koszyków EV są jednoznaczne", () => {
  assert.equal(expectedValueCalibrationBucket(-0.01).key, "negative");
  assert.equal(expectedValueCalibrationBucket(0).key, "0_2");
  assert.equal(expectedValueCalibrationBucket(2).key, "2_5");
  assert.equal(expectedValueCalibrationBucket(5).key, "5_10");
  assert.equal(expectedValueCalibrationBucket(10).key, "10_plus");
});

test("segment EV liczy profit i ROI tylko z pełnych danych finansowych", () => {
  const calibration = summarizeJournalCalibration([
    entry({ result: "WIN", expectedValue: 6, odds: 2, stake: 100 }),
    entry({ result: "LOSS", expectedValue: 6, odds: 2, stake: 100 }),
    entry({ result: "WIN", expectedValue: 6, odds: null, stake: 100 }),
  ]);
  const row = calibration.byExpectedValue.find((item) => item.key === "5_10");

  assert.equal(row?.resolvedEntries, 3);
  assert.equal(row?.financialEntries, 2);
  assert.equal(row?.turnover, 200);
  assert.equal(row?.profit, 0);
  assert.equal(row?.roi, 0);
});

test("mała próba znika od dziesięciu rozliczonych obserwacji", () => {
  const entries = Array.from({ length: 10 }, (_, index) => entry({
    result: index % 2 === 0 ? "WIN" : "LOSS",
    modelProbability: 55,
  }));
  const full = summarizeJournalCalibration(entries).byProbability[0];
  const small = summarizeJournalCalibration(entries.slice(0, 9)).byProbability[0];

  assert.equal(full?.smallSample, false);
  assert.equal(small?.smallSample, true);
});

test("kalibracja grupuje po wersji modelu, rynku, lidze i kierunku", () => {
  const calibration = summarizeJournalCalibration([
    entry(),
    entry({ modelVersion: "model-v2", statKey: "shots", statLabel: "Strzały", side: "UNDER" }),
    entry({ leagueId: "eng", leagueName: "Premier League" }),
  ]);

  assert.equal(calibration.byModelVersion.length, 2);
  assert.equal(calibration.byMarket.length, 2);
  assert.equal(calibration.byLeague.length, 2);
  assert.equal(calibration.bySide.length, 2);
});

test("statusy decyzji są widoczne osobno, ale nierozliczone nie tworzą Brier Score", () => {
  const calibration = summarizeJournalCalibration([
    entry({ status: "WATCHING", result: null }),
    entry({ status: "PLAYED", result: null }),
    entry({ status: "SETTLED", result: "WIN" }),
  ]);
  const watching = calibration.byDecisionStatus.find((row) => row.key === "WATCHING");
  const settled = calibration.byDecisionStatus.find((row) => row.key === "SETTLED");

  assert.equal(watching?.snapshotEntries, 1);
  assert.equal(watching?.resolvedEntries, 0);
  assert.equal(watching?.brierScore, null);
  assert.equal(settled?.resolvedEntries, 1);
});
