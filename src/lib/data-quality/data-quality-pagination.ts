export const DATA_QUALITY_PAGE_SIZE = 50;
export const DATA_QUALITY_BATCH_SIZE = 300;
export const DATA_QUALITY_SCAN_LIMIT = 10_000;

export function normalizeDataQualityPagination(input: {
  requestedPage?: number | null;
  requestedPageSize?: number | null;
  totalItems: number;
}) {
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      Math.trunc(
        input.requestedPageSize ?? DATA_QUALITY_PAGE_SIZE,
      ),
    ),
  );
  const totalItems = Math.max(0, Math.trunc(input.totalItems));
  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / pageSize),
  );
  const requestedPage = Math.max(
    1,
    Math.trunc(input.requestedPage ?? 1),
  );
  const page = Math.min(requestedPage, totalPages);

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    skip: (page - 1) * pageSize,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

export function dataQualityBatchPlan(input: {
  totalMatches: number;
  scanLimit?: number;
  batchSize?: number;
}) {
  const totalMatches = Math.max(
    0,
    Math.trunc(input.totalMatches),
  );
  const scanLimit = Math.max(
    1,
    Math.trunc(
      input.scanLimit ?? DATA_QUALITY_SCAN_LIMIT,
    ),
  );
  const batchSize = Math.max(
    1,
    Math.trunc(
      input.batchSize ?? DATA_QUALITY_BATCH_SIZE,
    ),
  );
  const matchesToScan = Math.min(totalMatches, scanLimit);
  const batches: Array<{ skip: number; take: number }> = [];

  for (
    let skip = 0;
    skip < matchesToScan;
    skip += batchSize
  ) {
    batches.push({
      skip,
      take: Math.min(
        batchSize,
        matchesToScan - skip,
      ),
    });
  }

  return {
    batches,
    matchesToScan,
    truncated: totalMatches > scanLimit,
  };
}
