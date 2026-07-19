import assert from "node:assert/strict";
import test from "node:test";
import {
  runMarketBacktest,
  type BacktestMatch,
} from "@/lib/stats/market-backtest";

function match(input: {
  id: string;
  date: string;
  home: string;
  away: string;
  homeCorners?: number | null;
  awayCorners?: number | null;
}): BacktestMatch {
  return {
    id: input.id,
    kickoffAt: new Date(input.date),
    round: null,
    homeTeamId: input.home,
    awayTeamId: input.away,
    homeScore: 0,
    awayScore: 0,
    stats: {
      homeCorners: input.homeCorners ?? null,
      awayCorners: input.awayCorners ?? null,
    },
    homeTeam: { id: input.home, name: input.home },
    awayTeam: { id: input.away, name: input.away },
  };
}

function baseMatches() {
  return [
    match({ id: "1", date: "2026-01-01", home: "H", away: "X1", homeCorners: 6, awayCorners: 4 }),
    match({ id: "2", date: "2026-01-02", home: "H", away: "X2", homeCorners: 8, awayCorners: 2 }),
    match({ id: "3", date: "2026-01-03", home: "Y1", away: "A", homeCorners: 5, awayCorners: 3 }),
    match({ id: "4", date: "2026-01-04", home: "Y2", away: "A", homeCorners: 7, awayCorners: 5 }),
    match({ id: "5", date: "2026-01-10", home: "H", away: "A", homeCorners: 7, awayCorners: 5 }),
  ];
}

test("backtest używa wyłącznie meczów rozegranych przed badanym spotkaniem", () => {
  const result = runMarketBacktest({
    matches: [
      ...baseMatches(),
      match({ id: "6", date: "2026-02-01", home: "H", away: "A", homeCorners: 30, awayCorners: 30 }),
    ],
    statKey: "corners",
    threshold: 9.5,
    side: "BOTH",
    lookback: 10,
    minSample: 2,
    minEdge: 0,
  });

  const firstSignal = result.signalsRows.find((row) => row.matchId === "5");
  assert.equal(firstSignal?.projection, 10);
  assert.equal(firstSignal?.actual, 12);
  assert.equal(firstSignal?.result, "WIN");
});

test("minimum próby zatrzymuje sygnał bez wystarczającej historii", () => {
  const result = runMarketBacktest({
    matches: baseMatches(),
    statKey: "corners",
    threshold: 9.5,
    side: "BOTH",
    lookback: 10,
    minSample: 3,
    minEdge: 0,
  });

  assert.equal(result.signals, 0);
  assert.equal(result.skippedSample, 1);
});

test("brak rzeczywistej statystyki jest pomijany zamiast zamiany na zero", () => {
  const matches = baseMatches();
  matches[4] = match({
    id: "5",
    date: "2026-01-10",
    home: "H",
    away: "A",
    homeCorners: null,
    awayCorners: 5,
  });

  const result = runMarketBacktest({
    matches,
    statKey: "corners",
    threshold: 9.5,
    side: "BOTH",
    lookback: 10,
    minSample: 2,
    minEdge: 0,
  });

  assert.equal(result.signals, 0);
  assert.equal(result.skippedMissingActual, 1);
});

test("filtr przewagi odrzuca projekcję zbyt blisko linii", () => {
  const result = runMarketBacktest({
    matches: baseMatches(),
    statKey: "corners",
    threshold: 9.5,
    side: "BOTH",
    lookback: 10,
    minSample: 2,
    minEdge: 1,
  });

  assert.equal(result.eligibleMatches, 1);
  assert.equal(result.signals, 0);
  assert.equal(result.skippedNoEdge, 1);
});

test("kierunek UNDER poprawnie klasyfikuje zwycięstwo", () => {
  const matches = [
    match({ id: "1", date: "2026-01-01", home: "H", away: "X1", homeCorners: 3, awayCorners: 5 }),
    match({ id: "2", date: "2026-01-02", home: "H", away: "X2", homeCorners: 4, awayCorners: 4 }),
    match({ id: "3", date: "2026-01-03", home: "Y1", away: "A", homeCorners: 4, awayCorners: 2 }),
    match({ id: "4", date: "2026-01-04", home: "Y2", away: "A", homeCorners: 5, awayCorners: 3 }),
    match({ id: "5", date: "2026-01-10", home: "H", away: "A", homeCorners: 4, awayCorners: 4 }),
  ];

  const result = runMarketBacktest({
    matches,
    statKey: "corners",
    threshold: 9.5,
    side: "UNDER",
    lookback: 10,
    minSample: 2,
    minEdge: 0.5,
  });

  assert.equal(result.signals, 1);
  assert.equal(result.wins, 1);
  assert.equal(result.signalsRows[0]?.side, "UNDER");
});

test("lookback 5 usuwa starszy odstający mecz", () => {
  const matches: BacktestMatch[] = [];
  for (let index = 0; index < 6; index += 1) {
    matches.push(match({
      id: `h${index}`,
      date: `2026-01-${String(index + 1).padStart(2, "0")}`,
      home: "H",
      away: `X${index}`,
      homeCorners: index === 0 ? 100 : 5,
      awayCorners: 5,
    }));
    matches.push(match({
      id: `a${index}`,
      date: `2026-01-${String(index + 10).padStart(2, "0")}`,
      home: `Y${index}`,
      away: "A",
      homeCorners: 5,
      awayCorners: 5,
    }));
  }
  matches.push(match({
    id: "target",
    date: "2026-02-01",
    home: "H",
    away: "A",
    homeCorners: 5,
    awayCorners: 5,
  }));

  const result = runMarketBacktest({
    matches,
    statKey: "corners",
    threshold: 9.5,
    side: "BOTH",
    lookback: 5,
    minSample: 5,
    minEdge: 0,
  });

  const target = result.signalsRows.find((row) => row.matchId === "target");
  assert.equal(target?.projection, 10);
});

test("wynik równy całkowitej linii jest pushem", () => {
  const result = runMarketBacktest({
    matches: baseMatches(),
    statKey: "corners",
    threshold: 12,
    side: "OVER",
    lookback: 10,
    minSample: 2,
    minEdge: 0,
  });

  assert.equal(result.signals, 0);
  assert.equal(result.pushes, 0);
});

test("podsumowania stron, miesięcy i drużyn są generowane", () => {
  const result = runMarketBacktest({
    matches: baseMatches(),
    statKey: "corners",
    threshold: 9.5,
    side: "BOTH",
    lookback: 10,
    minSample: 2,
    minEdge: 0,
  });

  assert.equal(result.sideBreakdown[0]?.signals, 1);
  assert.equal(result.monthlyBreakdown[0]?.key, "2026-01");
  assert.equal(result.teamBreakdown.some((row) => row.teamId === "H"), true);
  assert.equal(result.coverage, 100);
});
