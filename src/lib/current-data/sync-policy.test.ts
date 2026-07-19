import assert from "node:assert/strict";
import test from "node:test";
import { ImportStatus } from "@/generated/prisma/enums";
import {
  isActiveCurrentSyncBatch,
  parseCurrentSyncDay,
  selectNextCurrentSyncCandidate,
} from "@/lib/current-data/sync-policy";

test("CRON rotuje sezon po przygotowaniu raportu bez jego zatwierdzania", () => {
  const seasons = [
    { id: "a", label: "Bundesliga", lastSelectedAt: null as Date | null },
    { id: "b", label: "Premier League", lastSelectedAt: null as Date | null },
  ];

  const first = selectNextCurrentSyncCandidate(seasons);
  assert.equal(first?.id, "a");

  seasons[0]!.lastSelectedAt = new Date("2026-07-19T18:00:00.000Z");
  const second = selectNextCurrentSyncCandidate(seasons);
  assert.equal(second?.id, "b");
  assert.notEqual(second?.id, first?.id);
});

test("najdawniej przygotowany sezon ma pierwszenstwo", () => {
  const selected = selectNextCurrentSyncCandidate([
    { id: "new", label: "Nowy", lastSelectedAt: new Date("2026-07-19T18:00:00.000Z") },
    { id: "old", label: "Stary", lastSelectedAt: new Date("2026-07-18T18:00:00.000Z") },
  ]);

  assert.equal(selected?.id, "old");
});

test("aktywny raport obejmuje READY i VALIDATING", () => {
  assert.equal(isActiveCurrentSyncBatch(ImportStatus.READY), true);
  assert.equal(isActiveCurrentSyncBatch(ImportStatus.VALIDATING), true);
  assert.equal(isActiveCurrentSyncBatch(ImportStatus.COMPLETED), false);
  assert.equal(isActiveCurrentSyncBatch(ImportStatus.FAILED), false);
});

test("zakres synchronizacji przyjmuje tylko prawidlowy dzien ISO", () => {
  assert.equal(parseCurrentSyncDay("2026-07-19")?.toISOString(), "2026-07-19T00:00:00.000Z");
  assert.equal(parseCurrentSyncDay("2026-02-31"), null);
  assert.equal(parseCurrentSyncDay("19-07-2026"), null);
});
