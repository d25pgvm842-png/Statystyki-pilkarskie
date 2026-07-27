-- CreateEnum
CREATE TYPE "HistoricalBackfillStatus" AS ENUM (
  'READY',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'FAILED'
);

-- CreateTable
CREATE TABLE "HistoricalBackfillJob" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "providerCode" TEXT NOT NULL,
  "providerLeagueId" INTEGER NOT NULL,
  "providerSeason" INTEGER NOT NULL,
  "status" "HistoricalBackfillStatus" NOT NULL DEFAULT 'READY',
  "fixtureIds" JSONB NOT NULL,
  "cursor" INTEGER NOT NULL DEFAULT 0,
  "fixturesTotal" INTEGER NOT NULL DEFAULT 0,
  "fixturesProcessed" INTEGER NOT NULL DEFAULT 0,
  "activeBatchId" TEXT,
  "activeBatchSize" INTEGER NOT NULL DEFAULT 0,
  "requestsUsed" INTEGER NOT NULL DEFAULT 0,
  "importedRows" INTEGER NOT NULL DEFAULT 0,
  "duplicateRows" INTEGER NOT NULL DEFAULT 0,
  "invalidRows" INTEGER NOT NULL DEFAULT 0,
  "cornersCovered" INTEGER NOT NULL DEFAULT 0,
  "cardsCovered" INTEGER NOT NULL DEFAULT 0,
  "shotsCovered" INTEGER NOT NULL DEFAULT 0,
  "foulsCovered" INTEGER NOT NULL DEFAULT 0,
  "offsidesCovered" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "lockToken" TEXT,
  "lockedUntil" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HistoricalBackfillJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HistoricalBackfillJob_providerCode_providerLeagueId_providerSeason_key"
ON "HistoricalBackfillJob"("providerCode", "providerLeagueId", "providerSeason");

CREATE INDEX "HistoricalBackfillJob_status_updatedAt_idx"
ON "HistoricalBackfillJob"("status", "updatedAt");

CREATE INDEX "HistoricalBackfillJob_seasonId_createdAt_idx"
ON "HistoricalBackfillJob"("seasonId", "createdAt");

CREATE INDEX "HistoricalBackfillJob_createdById_createdAt_idx"
ON "HistoricalBackfillJob"("createdById", "createdAt");

ALTER TABLE "HistoricalBackfillJob"
ADD CONSTRAINT "HistoricalBackfillJob_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HistoricalBackfillJob"
ADD CONSTRAINT "HistoricalBackfillJob_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
