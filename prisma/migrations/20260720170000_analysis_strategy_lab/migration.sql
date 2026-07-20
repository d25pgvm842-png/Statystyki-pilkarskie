ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'ANALYSIS_STRATEGY';

CREATE TABLE "AnalysisStrategy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "leagueId" TEXT,
    "seasonId" TEXT,
    "statKey" TEXT,
    "scope" TEXT,
    "target" TEXT,
    "side" TEXT,
    "source" TEXT,
    "modelVersion" TEXT,
    "marketStatus" TEXT,
    "evidenceStatus" TEXT,
    "bookmaker" TEXT,
    "decisionMode" TEXT NOT NULL DEFAULT 'ALL',
    "minModelProbability" DOUBLE PRECISION,
    "maxModelProbability" DOUBLE PRECISION,
    "minExpectedValue" DOUBLE PRECISION,
    "maxExpectedValue" DOUBLE PRECISION,
    "minOdds" DOUBLE PRECISION,
    "maxOdds" DOUBLE PRECISION,
    "minThreshold" DOUBLE PRECISION,
    "maxThreshold" DOUBLE PRECISION,
    "minEdge" DOUBLE PRECISION,
    "minModelSample" INTEGER,
    "minCoverage" DOUBLE PRECISION,
    "minBacktestSignals" INTEGER,
    "minBacktestHitRate" DOUBLE PRECISION,
    "minimumConfidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisStrategy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalysisStrategy_userId_name_key"
ON "AnalysisStrategy"("userId", "name");

CREATE INDEX "AnalysisStrategy_userId_active_updatedAt_idx"
ON "AnalysisStrategy"("userId", "active", "updatedAt");

CREATE INDEX "AnalysisStrategy_leagueId_idx"
ON "AnalysisStrategy"("leagueId");

CREATE INDEX "AnalysisStrategy_seasonId_idx"
ON "AnalysisStrategy"("seasonId");

ALTER TABLE "AnalysisStrategy"
ADD CONSTRAINT "AnalysisStrategy_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
