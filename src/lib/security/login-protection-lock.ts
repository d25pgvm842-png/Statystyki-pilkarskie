import type { Prisma } from "@/generated/prisma/client";

type LoginProtectionTransaction = Pick<
  Prisma.TransactionClient,
  "$queryRaw"
>;

export async function lockLoginProtectionTarget(
  tx: LoginProtectionTransaction,
  key: string,
) {
  await tx.$queryRaw<Array<{ lock: string | null }>>`
    SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS "lock"
  `;
}
