import assert from "node:assert/strict";
import test from "node:test";
import {
  DATA_QUALITY_PAGE_SIZE,
  dataQualityBatchPlan,
  normalizeDataQualityPagination,
} from "./data-quality-pagination";

test("domyślnie pokazuje 50 problemów", () => {
  const pagination = normalizeDataQualityPagination({
    totalItems: 0,
  });

  assert.equal(
    pagination.pageSize,
    DATA_QUALITY_PAGE_SIZE,
  );
  assert.equal(pagination.page, 1);
  assert.equal(pagination.totalPages, 1);
});

test("ogranicza stronę do istniejącego zakresu", () => {
  const pagination = normalizeDataQualityPagination({
    requestedPage: 99,
    requestedPageSize: 50,
    totalItems: 121,
  });

  assert.equal(pagination.page, 3);
  assert.equal(pagination.skip, 100);
  assert.equal(pagination.hasPreviousPage, true);
  assert.equal(pagination.hasNextPage, false);
});

test("dzieli skan na partie po 300 rekordów", () => {
  assert.deepEqual(
    dataQualityBatchPlan({
      totalMatches: 750,
      scanLimit: 1_000,
      batchSize: 300,
    }),
    {
      batches: [
        { skip: 0, take: 300 },
        { skip: 300, take: 300 },
        { skip: 600, take: 150 },
      ],
      matchesToScan: 750,
      truncated: false,
    },
  );
});

test("ogranicza skan całej historii", () => {
  const plan = dataQualityBatchPlan({
    totalMatches: 25_000,
    scanLimit: 10_000,
    batchSize: 300,
  });

  assert.equal(plan.matchesToScan, 10_000);
  assert.equal(plan.truncated, true);
  assert.equal(
    plan.batches.reduce(
      (sum, batch) => sum + batch.take,
      0,
    ),
    10_000,
  );
});
