import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type ExternalEntityTypeValue = "LEAGUE" | "TEAM";

export type ExternalMappingRecord = {
  id: string;
  providerCode: string;
  entityType: ExternalEntityTypeValue;
  internalId: string;
  externalId: string;
  externalName: string | null;
  metadata: Prisma.JsonValue | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type DbClient = typeof prisma | Prisma.TransactionClient;

export async function listExternalMappings(
  where: { providerCode: string; entityType?: ExternalEntityTypeValue; active?: boolean },
  client: DbClient = prisma,
) {
  const entityType = where.entityType ?? null;
  const active = where.active ?? null;
  return client.$queryRaw<ExternalMappingRecord[]>`
    SELECT * FROM "ExternalMapping"
    WHERE "providerCode" = ${where.providerCode}
      AND (${entityType}::text IS NULL OR "entityType"::text = ${entityType})
      AND (${active}::boolean IS NULL OR "active" = ${active})
    ORDER BY "updatedAt" DESC
  `;
}

export async function findExternalMapping(
  where: {
    providerCode: string;
    entityType: ExternalEntityTypeValue;
    externalId?: string;
    internalId?: string;
  },
  client: DbClient = prisma,
) {
  const externalId = where.externalId ?? null;
  const internalId = where.internalId ?? null;
  const rows = await client.$queryRaw<ExternalMappingRecord[]>`
    SELECT * FROM "ExternalMapping"
    WHERE "providerCode" = ${where.providerCode}
      AND "entityType"::text = ${where.entityType}
      AND (${externalId}::text IS NULL OR "externalId" = ${externalId})
      AND (${internalId}::text IS NULL OR "internalId" = ${internalId})
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function replaceExternalMapping(
  input: {
    providerCode: string;
    entityType: ExternalEntityTypeValue;
    internalId: string;
    externalId: string;
    externalName?: string | null;
    metadata?: Prisma.InputJsonValue | null;
    active?: boolean;
  },
  client: DbClient = prisma,
) {
  const id = randomUUID();
  const metadata = input.metadata === undefined || input.metadata === null
    ? null
    : JSON.stringify(input.metadata);
  const active = input.active ?? true;

  await client.$executeRaw`
    DELETE FROM "ExternalMapping"
    WHERE "providerCode" = ${input.providerCode}
      AND "entityType"::text = ${input.entityType}
      AND ("externalId" = ${input.externalId} OR "internalId" = ${input.internalId})
  `;

  await client.$executeRaw`
    INSERT INTO "ExternalMapping" (
      "id", "providerCode", "entityType", "internalId", "externalId",
      "externalName", "metadata", "active", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${input.providerCode}, ${input.entityType}::"ExternalEntityType",
      ${input.internalId}, ${input.externalId}, ${input.externalName ?? null},
      ${metadata}::jsonb, ${active}, NOW(), NOW()
    )
  `;
}
