export function preferIncoming<T>(
  existing: T | null | undefined,
  incoming: T | null | undefined,
): T | null {
  if (incoming !== null && incoming !== undefined) return incoming;
  return existing ?? null;
}

export function stableMatchStatus(existing: string, incoming: string) {
  if (existing === "FINISHED" && incoming !== "FINISHED") return existing;
  return incoming;
}
