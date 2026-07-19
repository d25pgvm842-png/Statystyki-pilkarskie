import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExternalPreviewActions,
  externalCandidateKey,
} from "@/lib/imports/external-preview-policy";

test("podgląd pokazuje wszystkie encje tworzone dopiero przy zatwierdzeniu", () => {
  const actions = buildExternalPreviewActions({
    operation: "CREATE",
    sourceExists: false,
    leagueMappingExists: false,
    home: {
      name: "Nowy Gospodarz",
      existingId: null,
      requiresMembership: true,
      requiresMapping: true,
    },
    away: {
      name: "Istniejący Gość",
      existingId: "team-away",
      requiresMembership: false,
      requiresMapping: true,
    },
    referee: {
      name: "Nowy Sędzia",
      existingId: null,
      requiresMembership: true,
    },
  });

  assert.deepEqual(actions, [
    "Utworzy nowy mecz",
    "Utworzy źródło danych",
    "Utworzy mapowanie ligi",
    "Utworzy drużynę: Nowy Gospodarz",
    "Przypisze drużynę do sezonu: Nowy Gospodarz",
    "Utworzy mapowanie drużyny: Nowy Gospodarz",
    "Utworzy mapowanie drużyny: Istniejący Gość",
    "Utworzy sędziego: Nowy Sędzia",
    "Przypisze sędziego do sezonu: Nowy Sędzia",
  ]);
});

test("istniejące kompletne encje nie generują fałszywych operacji", () => {
  const actions = buildExternalPreviewActions({
    operation: "UPDATE",
    sourceExists: true,
    leagueMappingExists: true,
    home: {
      name: "A",
      existingId: "a",
      requiresMembership: false,
      requiresMapping: false,
    },
    away: {
      name: "B",
      existingId: "b",
      requiresMembership: false,
      requiresMapping: false,
    },
    referee: null,
  });

  assert.deepEqual(actions, ["Zaktualizuje istniejący mecz"]);
});

test("klucz kandydata preferuje stabilne identyfikatory", () => {
  assert.equal(externalCandidateKey({ internalId: "team-1", externalId: "77", name: "A" }), "team-1");
  assert.equal(externalCandidateKey({ existingId: "team-2", externalId: "88", name: "B" }), "team-2");
  assert.equal(externalCandidateKey({ externalId: "99", name: "C" }), "99");
  assert.equal(externalCandidateKey({ name: "Legia Warszawa" }), "legia warszawa");
});
