-- CreateEnum
CREATE TYPE "ExternalEntityType" AS ENUM ('LEAGUE', 'TEAM');

-- CreateTable
CREATE TABLE "ExternalMapping" (
  "id" TEXT NOT NULL,
  "providerCode" TEXT NOT NULL,
  "entityType" "ExternalEntityType" NOT NULL,
  "internalId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "externalName" TEXT,
  "metadata" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalMapping_pkey" PRIMARY KEY ("id")
);

-- Stable provider identifiers prevent duplicate matches when kickoff changes.
CREATE UNIQUE INDEX "Match_dataSourceId_sourceExternalId_key"
ON "Match"("dataSourceId", "sourceExternalId");

CREATE UNIQUE INDEX "ExternalMapping_providerCode_entityType_internalId_key"
ON "ExternalMapping"("providerCode", "entityType", "internalId");

CREATE UNIQUE INDEX "ExternalMapping_providerCode_entityType_externalId_key"
ON "ExternalMapping"("providerCode", "entityType", "externalId");

CREATE INDEX "ExternalMapping_providerCode_entityType_active_idx"
ON "ExternalMapping"("providerCode", "entityType", "active");
