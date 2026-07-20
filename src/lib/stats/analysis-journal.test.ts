import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnalysisPickFingerprint,
  selectionClv,
  selectionProfit,
  settleTotalSelection,
  summarizeJournal,
  summarizeJournalAnalytics,
} from "@/lib/stats/analysis-journal";

test("fingerprint normalizuje linię i rozróżnia kierunek", () => {
  const over = buildAnalysisPickFingerprint({
    matchId: "match-1",
    statKey: "corners",
    scope: "MATCH_TOTAL",
    threshold: 9.5,
    side: "OVER",
  });
  const same = buildAnalysisPickFingerprint({
    matchId: "match-1",
    statKey: "corners",
    scope: "MATCH_TOTAL",
    threshold: 9.500,
    side: "OVER",
  });
  const under = buildAnalysisPickFingerprint({
    matchId: "match-1",
    statKey: "corners",
    scope: "MATCH_TOTAL",
    threshold: 9.5,
    side: "UNDER",
  });

  assert.equal(over, same);
  assert.notEqual(over, under);
});

test("rozliczenie over, under i push działa dla sumy meczu", () => {
  assert.equal(settleTotalSelection({ actual: 11, threshold: 9.5, side: "OVER" }), "WIN");
  assert.equal(settleTotalSelection({ actual: 8, threshold: 9.5, side: "UNDER" }), "WIN");
  assert.equal(settleTotalSelection({ actual: 10, threshold: 10, side: "OVER" }), "PUSH");
  assert.equal(settleTotalSelection({ actual: 11, threshold: 9.5, side: "UNDER" }), "LOSS");
});

test("wynik finansowy wykorzystuje kurs dziesiętny i stawkę", () => {
  assert.equal(selectionProfit({ result: "WIN", odds: 2.1, stake: 100 }), 110);
  assert.equal(selectionProfit({ result: "LOSS", odds: 2.1, stake: 100 }), -100);
  assert.equal(selectionProfit({ result: "PUSH", odds: 2.1, stake: 100 }), 0);
  assert.equal(selectionProfit({ result: "VOID", odds: 2.1, stake: 100 }), 0);
});

test("brak kursu nie tworzy fikcyjnego zysku po wygranej", () => {
  assert.equal(selectionProfit({ result: "WIN", odds: null, stake: 100 }), null);
  assert.equal(selectionProfit({ result: "LOSS", odds: null, stake: 100 }), null);
  assert.equal(selectionProfit({ result: "PUSH", odds: null, stake: 100 }), null);
  assert.equal(selectionProfit({ result: "WIN", odds: 2, stake: null }), null);
});

test("CLV jest dodatnie, gdy zapisany kurs jest wyższy od zamknięcia", () => {
  assert.equal(selectionClv({ odds: 2.1, closingOdds: 2 }), 5.000000000000004);
  assert.equal(selectionClv({ odds: null, closingOdds: 2 }), null);
});

test("podsumowanie liczy trafność, obrót, profit i ROI", () => {
  const summary = summarizeJournal([
    { status: "WATCHING", result: null, odds: null, closingOdds: null, stake: null },
    { status: "PLAYED", result: null, odds: 2, closingOdds: null, stake: 50 },
    { status: "SETTLED", result: "WIN", odds: 2, closingOdds: 1.9, stake: 100 },
    { status: "SETTLED", result: "LOSS", odds: 1.9, closingOdds: 2, stake: 100 },
    { status: "SETTLED", result: "PUSH", odds: 1.8, closingOdds: 1.8, stake: 50 },
  ]);

  assert.equal(summary.watching, 1);
  assert.equal(summary.playedOpen, 1);
  assert.equal(summary.settled, 3);
  assert.equal(summary.wins, 1);
  assert.equal(summary.losses, 1);
  assert.equal(summary.pushes, 1);
  assert.equal(summary.hitRate, 50);
  assert.equal(summary.turnover, 250);
  assert.equal(summary.profit, 0);
  assert.equal(summary.roi, 0);
  assert.equal(summary.financialEntries, 3);
});

test("zakład oznaczony VOID nie jest liczony jako trafiony ani przegrany", () => {
  const summary = summarizeJournal([
    { status: "VOID", result: "VOID", odds: 2, closingOdds: 1.9, stake: 100 },
  ]);

  assert.equal(summary.voided, 1);
  assert.equal(summary.wins, 0);
  assert.equal(summary.losses, 0);
  assert.equal(summary.hitRate, null);
  assert.equal(summary.settled, 0);
});

test("brak kursu wyklucza pozycję z ROI i obrotu", () => {
  const summary = summarizeJournal([
    { status: "SETTLED", result: "WIN", odds: null, closingOdds: null, stake: 100 },
    { status: "SETTLED", result: "LOSS", odds: null, closingOdds: null, stake: 50 },
  ]);

  assert.equal(summary.financialEntries, 0);
  assert.equal(summary.turnover, 0);
  assert.equal(summary.profit, 0);
  assert.equal(summary.roi, null);
});


test("analityka grupuje wyniki według ligi i rynku", () => {
  const analytics = summarizeJournalAnalytics([
    {
      status: "SETTLED",
      result: "WIN",
      odds: 2,
      closingOdds: 1.9,
      stake: 100,
      leagueId: "pl",
      leagueName: "Ekstraklasa",
      statKey: "corners",
      statLabel: "Rzuty rożne",
      side: "OVER",
      source: "SCANNER",
      evidenceStatus: "SUPPORTED",
    },
    {
      status: "SETTLED",
      result: "LOSS",
      odds: 1.9,
      closingOdds: 2,
      stake: 100,
      leagueId: "pl",
      leagueName: "Ekstraklasa",
      statKey: "corners",
      statLabel: "Rzuty rożne",
      side: "UNDER",
      source: "MANUAL",
      evidenceStatus: null,
    },
    {
      status: "WATCHING",
      result: null,
      odds: null,
      closingOdds: null,
      stake: null,
      leagueId: "eng",
      leagueName: "Premier League",
      statKey: "shots",
      statLabel: "Strzały",
      side: "OVER",
      source: "SCANNER",
      evidenceStatus: "WATCH",
    },
  ]);

  assert.equal(analytics.byLeague.length, 2);
  assert.equal(analytics.byLeague[0]?.label, "Ekstraklasa");
  assert.equal(analytics.byLeague[0]?.totalEntries, 2);
  assert.equal(analytics.byLeague[0]?.settled, 2);
  assert.equal(analytics.byLeague[0]?.hitRate, 50);
  assert.equal(analytics.byMarket.find((row) => row.key === "corners")?.profit, 0);
  assert.equal(analytics.bySource.find((row) => row.key === "MANUAL")?.label, "Ręczne");
  assert.equal(analytics.byEvidence.find((row) => row.key === "NONE")?.label, "Brak statusu");
});

test("mała próba znika dopiero od 10 rozliczonych pozycji", () => {
  const entries = Array.from({ length: 10 }, (_, index) => ({
    status: "SETTLED",
    result: index % 2 === 0 ? "WIN" as const : "LOSS" as const,
    odds: 2,
    closingOdds: 1.95,
    stake: 10,
    leagueId: "pl",
    leagueName: "Ekstraklasa",
    statKey: "corners",
    statLabel: "Rzuty rożne",
    side: "OVER" as const,
    source: "SCANNER",
    evidenceStatus: "SUPPORTED",
  }));

  const full = summarizeJournalAnalytics(entries).byLeague[0];
  const small = summarizeJournalAnalytics(entries.slice(0, 9)).byLeague[0];

  assert.equal(full?.smallSample, false);
  assert.equal(small?.smallSample, true);
});

test("segment bez danych finansowych ma ROI null", () => {
  const analytics = summarizeJournalAnalytics([
    {
      status: "SETTLED",
      result: "WIN",
      odds: null,
      closingOdds: null,
      stake: null,
      leagueId: "pl",
      leagueName: "Ekstraklasa",
      statKey: "corners",
      statLabel: "Rzuty rożne",
      side: "OVER",
      source: "MANUAL",
      evidenceStatus: null,
    },
  ]);

  assert.equal(analytics.byLeague[0]?.financialEntries, 0);
  assert.equal(analytics.byLeague[0]?.roi, null);
});
