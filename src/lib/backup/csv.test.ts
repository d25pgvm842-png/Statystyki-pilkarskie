import assert from "node:assert/strict";
import test from "node:test";
import { buildMatchesCsv, csvCell, exportFileDate, type MatchExportRow } from "./csv";

test("csvCell zabezpiecza średniki, cudzysłowy i nowe linie", () => {
  assert.equal(csvCell("zwykły tekst"), "zwykły tekst");
  assert.equal(csvCell("a;b"), '"a;b"');
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell("a\nb"), '"a\nb"');
});

test("buildMatchesCsv zachowuje wpisaną godzinę i komplet kolumn", () => {
  const match: MatchExportRow = {
    id: "m1",
    kickoffAt: new Date("2026-07-27T18:00:00.000Z"),
    round: 1,
    status: "FINISHED",
    homeScore: 2,
    awayScore: 1,
    note: "test; kontrola",
    sourceExternalId: null,
    season: { name: "2026/27", league: { name: "Ekstraklasa", country: "Polska" } },
    homeTeam: { name: "Górnik Zabrze" },
    awayTeam: { name: "Korona Kielce" },
    referee: { name: "Szymon Marciniak" },
    dataSource: { name: "Ręczne wprowadzanie" },
    stats: {
      homeCorners: 6,
      awayCorners: 5,
      homeYellowCards: 2,
      awayYellowCards: 3,
      homeRedCards: 0,
      awayRedCards: 0,
      homeShotsOnTarget: 5,
      awayShotsOnTarget: 4,
      homeShots: 15,
      awayShots: 12,
      homeFouls: 10,
      awayFouls: 11,
      homeOffsides: 1,
      awayOffsides: 2,
    },
  };

  const csv = buildMatchesCsv([match]);
  assert.ok(csv.startsWith("\uFEFFID;Liga;"));
  assert.match(csv, /2026-07-27 18:00/);
  assert.match(csv, /"test; kontrola"/);
  assert.match(csv, /Górnik Zabrze;Korona Kielce/);
});

test("exportFileDate zwraca stabilną datę pliku", () => {
  assert.equal(exportFileDate(new Date("2026-07-19T23:59:00.000Z")), "2026-07-19");
});
