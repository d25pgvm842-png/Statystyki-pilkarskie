export const JOURNAL_PAGE_SIZE = 50;
export const JOURNAL_ANALYTICS_LIMIT = 5_000;

export function normalizeJournalPagination(input: {
  requestedPage?: number | null;
  requestedPageSize?: number | null;
  totalItems: number;
}) {
  const pageSize = Math.min(
    100,
    Math.max(1, Math.trunc(input.requestedPageSize ?? JOURNAL_PAGE_SIZE)),
  );
  const totalItems = Math.max(0, Math.trunc(input.totalItems));
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
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
