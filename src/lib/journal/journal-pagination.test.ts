import assert from "node:assert/strict";
import test from "node:test";
import {
  JOURNAL_PAGE_SIZE,
  normalizeJournalPagination,
} from "./journal-pagination";

test("ustawia pierwszą stronę i domyślnie 50 pozycji", () => {
  assert.deepEqual(
    normalizeJournalPagination({
      requestedPage: null,
      requestedPageSize: null,
      totalItems: 0,
    }),
    {
      page: 1,
      pageSize: JOURNAL_PAGE_SIZE,
      totalItems: 0,
      totalPages: 1,
      skip: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    },
  );
});

test("ogranicza numer strony do istniejącego zakresu", () => {
  assert.deepEqual(
    normalizeJournalPagination({
      requestedPage: 99,
      requestedPageSize: 50,
      totalItems: 121,
    }),
    {
      page: 3,
      pageSize: 50,
      totalItems: 121,
      totalPages: 3,
      skip: 100,
      hasPreviousPage: true,
      hasNextPage: false,
    },
  );
});

test("ogranicza rozmiar strony do 100 pozycji", () => {
  const pagination = normalizeJournalPagination({
    requestedPage: 2,
    requestedPageSize: 999,
    totalItems: 250,
  });

  assert.equal(pagination.pageSize, 100);
  assert.equal(pagination.skip, 100);
  assert.equal(pagination.hasPreviousPage, true);
  assert.equal(pagination.hasNextPage, true);
});
