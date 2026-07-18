import assert from "node:assert/strict";
import test from "node:test";
import { buildImportReportCsv, countImportRowStatuses, importRowMessages } from "./report";

test("countImportRowStatuses zlicza wszystkie statusy", () => {
  const counts = countImportRowStatuses([
    { status: "VALID" },
    { status: "VALID" },
    { status: "DUPLICATE" },
    { status: "IMPORTED" },
    { status: "SKIPPED" },
    { status: "INVALID" },
  ]);

  assert.deepEqual(counts, {
    VALID: 2,
    DUPLICATE: 1,
    INVALID: 1,
    IMPORTED: 1,
    SKIPPED: 1,
  });
});

test("importRowMessages ignoruje wartości inne niż tekst", () => {
  assert.deepEqual(importRowMessages(["Błąd", 12, null, "Duplikat"]), ["Błąd", "Duplikat"]);
});

test("buildImportReportCsv zabezpiecza średniki i cudzysłowy", () => {
  const csv = buildImportReportCsv([
    {
      rowNumber: 2,
      status: "INVALID",
      rawData: {
        homeTeamName: 'Legia "A"',
        awayTeamName: "Lech; Poznań",
        homeScore: 1,
        awayScore: 0,
      },
      errors: ["Niepoprawna; wartość"],
    },
  ]);

  assert.match(csv, /^\uFEFF/);
  assert.match(csv, /"Legia ""A"""/);
  assert.match(csv, /"Lech; Poznań"/);
  assert.match(csv, /"Niepoprawna; wartość"/);
});
