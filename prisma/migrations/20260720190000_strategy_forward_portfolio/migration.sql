ALTER TABLE "AnalysisStrategy"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';

CREATE TABLE "AnalysisStrategyVersion" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'FORWARD_TEST',
    "activatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "config" JSONB NOT NULL,
    "historicalSnapshot" JSONB NOT NULL,
    "stakeMode" TEXT NOT NULL DEFAULT 'FIXED',
    "fixedStake" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "initialBankroll" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "bankrollPercent" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "kellyFraction" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "maxStakePercent" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "maxMatchExposurePercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "maxLeagueExposurePercent" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "maxMarketExposurePercent" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "maxDailyExposurePercent" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisStrategyVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StrategyForwardSignal" (
    "id" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "analysisPickId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decisionAt" TIMESTAMP(3) NOT NULL,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "leagueId" TEXT NOT NULL,
    "leagueName" TEXT NOT NULL,
    "seasonName" TEXT NOT NULL,
    "homeTeamName" TEXT NOT NULL,
    "awayTeamName" TEXT NOT NULL,
    "statKey" TEXT NOT NULL,
    "statLabel" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "bookmaker" TEXT,
    "oddsAtSignal" DOUBLE PRECISION,
    "closingOdds" DOUBLE PRECISION,
    "modelProbability" DOUBLE PRECISION,
    "expectedValue" DOUBLE PRECISION,
    "projection" DOUBLE PRECISION,
    "edge" DOUBLE PRECISION,
    "modelVersion" TEXT,
    "bankrollAtSignal" DOUBLE PRECISION NOT NULL,
    "fixedBankrollAtSignal" DOUBLE PRECISION NOT NULL,
    "percentageBankrollAtSignal" DOUBLE PRECISION NOT NULL,
    "kellyBankrollAtSignal" DOUBLE PRECISION NOT NULL,
    "fixedStake" DOUBLE PRECISION NOT NULL,
    "percentageStake" DOUBLE PRECISION NOT NULL,
    "kellyStake" DOUBLE PRECISION,
    "recommendedStake" DOUBLE PRECISION,
    "stakeMode" TEXT NOT NULL,
    "exposureStatus" TEXT NOT NULL DEFAULT 'OK',
    "result" "AnalysisPickResult",
    "actualValue" DOUBLE PRECISION,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategyForwardSignal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalysisStrategyVersion_strategyId_version_key"
ON "AnalysisStrategyVersion"("strategyId", "version");

CREATE INDEX "AnalysisStrategyVersion_userId_status_activatedAt_idx"
ON "AnalysisStrategyVersion"("userId", "status", "activatedAt");

CREATE INDEX "AnalysisStrategyVersion_strategyId_activatedAt_idx"
ON "AnalysisStrategyVersion"("strategyId", "activatedAt");

CREATE UNIQUE INDEX "StrategyForwardSignal_strategyVersionId_analysisPickId_key"
ON "StrategyForwardSignal"("strategyVersionId", "analysisPickId");

CREATE INDEX "StrategyForwardSignal_userId_decisionAt_idx"
ON "StrategyForwardSignal"("userId", "decisionAt");

CREATE INDEX "StrategyForwardSignal_strategyVersionId_kickoffAt_idx"
ON "StrategyForwardSignal"("strategyVersionId", "kickoffAt");

CREATE INDEX "StrategyForwardSignal_matchId_idx"
ON "StrategyForwardSignal"("matchId");

CREATE INDEX "StrategyForwardSignal_leagueId_kickoffAt_idx"
ON "StrategyForwardSignal"("leagueId", "kickoffAt");

CREATE INDEX "StrategyForwardSignal_statKey_kickoffAt_idx"
ON "StrategyForwardSignal"("statKey", "kickoffAt");

ALTER TABLE "AnalysisStrategyVersion"
ADD CONSTRAINT "AnalysisStrategyVersion_strategyId_fkey"
FOREIGN KEY ("strategyId") REFERENCES "AnalysisStrategy"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnalysisStrategyVersion"
ADD CONSTRAINT "AnalysisStrategyVersion_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StrategyForwardSignal"
ADD CONSTRAINT "StrategyForwardSignal_strategyVersionId_fkey"
FOREIGN KEY ("strategyVersionId") REFERENCES "AnalysisStrategyVersion"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StrategyForwardSignal"
ADD CONSTRAINT "StrategyForwardSignal_analysisPickId_fkey"
FOREIGN KEY ("analysisPickId") REFERENCES "AnalysisPick"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StrategyForwardSignal"
ADD CONSTRAINT "StrategyForwardSignal_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StrategyForwardSignal"
ADD CONSTRAINT "StrategyForwardSignal_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
