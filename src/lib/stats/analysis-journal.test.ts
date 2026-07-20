import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnalysisPickFingerprint,
  selectionClv,
  selectionProfit,
  settleTotalSelection,
  summarizeJournal,
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
  assert.equal(selectionProfit({ result: "LOSS", odds: null, stake: 100 }), -100);
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

test("wygrana bez kursu nie zaniża ROI przez fikcyjny obrót", () => {
  const summary = summarizeJournal([
    { status: "SETTLED", result: "WIN", odds: null, closingOdds: null, stake: 100 },
    { status: "SETTLED", result: "LOSS", odds: null, closingOdds: null, stake: 50 },
  ]);

  assert.equal(summary.financialEntries, 1);
  assert.equal(summary.turnover, 50);
  assert.equal(summary.profit, -50);
  assert.equal(summary.roi, -100);
});
