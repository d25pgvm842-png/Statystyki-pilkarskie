import assert from "node:assert/strict";
import test from "node:test";
import {
  scanUpcomingMarket,
  scannerEvidenceStatus,
  type ScannerMatch,
} from "@/lib/stats/market-scanner";
import type { BacktestMatch } from "@/lib/stats/market-backtest";

function finished(input: {
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

function upcoming(date = "2026-03-01"): ScannerMatch {
  return {
    id: "target",
    kickoffAt: new Date(date),
    round: 20,
    homeTeamId: "H",
    awayTeamId: "A",
    homeScore: null,
    awayScore: null,
    stats: null,
    homeTeam: { id: "H", name: "Home" },
    awayTeam: { id: "A", name: "Away" },
  };
}

function history() {
  return [
    finished({ id: "h1", date: "2026-01-01", home: "H", away: "X1", homeCorners: 7, awayCorners: 3 }),
    finished({ id: "h2", date: "2026-01-05", home: "H", away: "X2", homeCorners: 8, awayCorners: 4 }),
    finished({ id: "h3", date: "2026-01-10", home: "H", away: "X3", homeCorners: 6, awayCorners: 4 }),
    finished({ id: "a1", date: "2026-01-02", home: "Y1", away: "A", homeCorners: 5, awayCorners: 4 }),
    finished({ id: "a2", date: "2026-01-06", home: "Y2", away: "A", homeCorners: 6, awayCorners: 5 }),
    finished({ id: "a3", date: "2026-01-11", home: "Y3", away: "A", homeCorners: 5, awayCorners: 4 }),
  ];
}

test("skaner tworzy kandydaturę OVER z pełnej projekcji", () => {
  const result = scanUpcomingMarket({
    finishedMatches: history(),
    upcomingMatches: [upcoming()],
    statKey: "corners",
    threshold: 9.5,
    side: "BOTH",
    lookback: 10,
    minSample: 3,
    minEdge: 0.5,
  });

  assert.equal(result.candidatesTotal, 1);
  assert.equal(result.candidates[0]?.side, "OVER");
  assert.equal(result.candidates[0]?.projection, 10.166666666666666);
  assert.equal(result.candidates[0]?.edge, 0.6666666666666661);
});

test("mecz po terminie skanowanego spotkania nie wpływa na projekcję", () => {
  const base = scanUpcomingMarket({
    finishedMatches: history(),
    upcomingMatches: [upcoming()],
    statKey: "corners",
    threshold: 9.5,
    side: "BOTH",
    lookback: 10,
    minSample: 3,
    minEdge: 0,
  });
  const withFuture = scanUpcomingMarket({
    finishedMatches: [
      ...history(),
      finished({ id: "future", date: "2026-04-01", home: "H", away: "A", homeCorners: 50, awayCorners: 50 }),
    ],
    upcomingMatches: [upcoming()],
    statKey: "corners",
    threshold: 9.5,
    side: "BOTH",
    lookback: 10,
    minSample: 3,
    minEdge: 0,
  });

  assert.equal(withFuture.candidates[0]?.projection, base.candidates[0]?.projection);
});

test("zbyt mała próba zatrzymuje kandydaturę", () => {
  const result = scanUpcomingMarket({
    finishedMatches: history().slice(0, 4),
    upcomingMatches: [upcoming()],
    statKey: "corners",
    threshold: 9.5,
    side: "BOTH",
    lookback: 10,
    minSample: 3,
    minEdge: 0,
  });

  assert.equal(result.candidatesTotal, 0);
  assert.equal(result.skippedSample, 1);
});

test("brak pełnej statystyki nie jest zamieniany na zero", () => {
  const broken = history();
  broken[0] = finished({
    id: "h1",
    date: "2026-01-01",
    home: "H",
    away: "X1",
    homeCorners: 7,
    awayCorners: null,
  });

  const result = scanUpcomingMarket({
    finishedMatches: broken,
    upcomingMatches: [upcoming()],
    statKey: "corners",
    threshold: 9.5,
    side: "BOTH",
    lookback: 10,
    minSample: 3,
    minEdge: 0,
  });

  assert.equal(result.candidatesTotal, 0);
  assert.equal(result.skippedSample, 1);
});

test("filtr kierunku nie dopuszcza przeciwnego sygnału", () => {
  const result = scanUpcomingMarket({
    finishedMatches: history(),
    upcomingMatches: [upcoming()],
    statKey: "corners",
    threshold: 9.5,
    side: "UNDER",
    lookback: 10,
    minSample: 3,
    minEdge: 0.5,
  });

  assert.equal(result.candidatesTotal, 0);
  assert.equal(result.skippedNoEdge, 1);
});

test("minimalna przewaga odrzuca projekcję blisko linii", () => {
  const result = scanUpcomingMarket({
    finishedMatches: history(),
    upcomingMatches: [upcoming()],
    statKey: "corners",
    threshold: 10,
    side: "BOTH",
    lookback: 10,
    minSample: 3,
    minEdge: 0.5,
  });

  assert.equal(result.candidatesTotal, 0);
  assert.equal(result.skippedNoEdge, 1);
});

test("status wsparte historią wymaga obu odpowiednich prób", () => {
  assert.equal(scannerEvidenceStatus({
    sideSignals: 20,
    sideHitRate: 56,
    edgeSignals: 8,
    edgeHitRate: 57,
  }), "SUPPORTED");

  assert.equal(scannerEvidenceStatus({
    sideSignals: 20,
    sideHitRate: 56,
    edgeSignals: 3,
    edgeHitRate: 70,
  }), "UNVERIFIED");
});

test("kandydaci są sortowani według statusu, przewagi i terminu", () => {
  const result = scanUpcomingMarket({
    finishedMatches: history(),
    upcomingMatches: [
      upcoming("2026-03-03"),
      { ...upcoming("2026-03-02"), id: "target-2" },
    ],
    statKey: "corners",
    threshold: 9.5,
    side: "BOTH",
    lookback: 10,
    minSample: 3,
    minEdge: 0.5,
  });

  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0]?.matchId, "target-2");
});
