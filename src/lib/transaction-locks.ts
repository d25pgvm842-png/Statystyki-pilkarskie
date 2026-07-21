import type { Prisma } from "@/generated/prisma/client";

export type TransactionClient = Prisma.TransactionClient;

const LOCK_NAMESPACE = "staty-pilkarskie";

export function transactionLockKey(resource: string, id: string) {
  return `${LOCK_NAMESPACE}:${resource}:${id}`;
}

export async function lockTransactionResource(
  tx: TransactionClient,
  resource: "analysis-pick" | "daily-play-plan" | "match",
  id: string,
) {
  const key = transactionLockKey(resource, id);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
