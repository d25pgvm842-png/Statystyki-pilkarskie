import assert from "node:assert/strict";
import test from "node:test";
import { repairableHistoricalErrors, repairedHistoricalCounters } from "./backfill-repair-policy";

test("naprawia tylko niejednoznaczne drużyny", () => {
  assert.equal(repairableHistoricalErrors(["Niejednoznaczne dopasowanie gospodarza Cracovia Krakow: Cracovia, Cracovia."]), true);
  assert.equal(repairableHistoricalErrors(["Nieprawidłowa data meczu."]), false);
});

test("synchronizuje liczniki bez wartości ujemnych", () => {
  assert.deepEqual(repairedHistoricalCounters({ importedRows: 5, duplicateRows: 0, invalidRows: 13, imported: 8, duplicates: 2 }), { importedRows: 13, duplicateRows: 2, invalidRows: 3 });
});
