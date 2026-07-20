ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'ANALYSIS_PICK';

CREATE TYPE "AnalysisPickSide" AS ENUM ('OVER', 'UNDER');
CREATE TYPE "AnalysisPickStatus" AS ENUM ('WATCHING', 'PLAYED', 'REJECTED', 'SETTLED', 'VOID');
CREATE TYPE "AnalysisPickResult" AS ENUM ('WIN', 'LOSS', 'PUSH', 'VOID');
CREATE TYPE "AnalysisPickSource" AS ENUM ('SCANNER', 'MANUAL');

CREATE TABLE "AnalysisPick" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "source" "AnalysisPickSource" NOT NULL DEFAULT 'MANUAL',
    "statKey" TEXT NOT NULL,
    "statLabel" TEXT NOT NULL,
    "scope" "LineScope" NOT NULL DEFAULT 'MATCH_TOTAL',
    "threshold" DOUBLE PRECISION NOT NULL,
    "side" "AnalysisPickSide" NOT NULL,
    "status" "AnalysisPickStatus" NOT NULL DEFAULT 'WATCHING',
    "result" "AnalysisPickResult",
    "projection" DOUBLE PRECISION,
    "edge" DOUBLE PRECISION,
    "evidenceStatus" TEXT,
    "backtestSignals" INTEGER,
    "backtestHitRate" DOUBLE PRECISION,
    "edgeBacktestSignals" INTEGER,
    "edgeBacktestHitRate" DOUBLE PRECISION,
    "homeSample" INTEGER,
    "awaySample" INTEGER,
    "bookmaker" TEXT,
    "odds" DOUBLE PRECISION,
    "closingOdds" DOUBLE PRECISION,
    "stake" DOUBLE PRECISION,
    "actualValue" DOUBLE PRECISION,
    "note" TEXT,
    "placedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisPick_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalysisPick_userId_fingerprint_key"
ON "AnalysisPick"("userId", "fingerprint");

CREATE INDEX "AnalysisPick_userId_status_createdAt_idx"
ON "AnalysisPick"("userId", "status", "createdAt");

CREATE INDEX "AnalysisPick_matchId_idx"
ON "AnalysisPick"("matchId");

CREATE INDEX "AnalysisPick_status_matchId_idx"
ON "AnalysisPick"("status", "matchId");

ALTER TABLE "AnalysisPick"
ADD CONSTRAINT "AnalysisPick_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnalysisPick"
ADD CONSTRAINT "AnalysisPick_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
