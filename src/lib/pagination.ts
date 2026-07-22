export function paginationState(input: {
  requestedPage: string | number | null | undefined;
  totalItems: number;
  pageSize: number;
}) {
  const parsed = Number(input.requestedPage);
  const requested = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  const totalPages = Math.max(1, Math.ceil(Math.max(0, input.totalItems) / input.pageSize));
  const page = Math.min(requested, totalPages);
  return {
    page,
    pageSize: input.pageSize,
    totalPages,
    skip: (page - 1) * input.pageSize,
    from: input.totalItems ? (page - 1) * input.pageSize + 1 : 0,
    to: Math.min(page * input.pageSize, input.totalItems),
  };
}

export function paginationHref(
  path: string,
  params: Record<string, string | string[] | undefined>,
  page: number,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    if (typeof value === "string" && value) query.set(key, value);
  }
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
