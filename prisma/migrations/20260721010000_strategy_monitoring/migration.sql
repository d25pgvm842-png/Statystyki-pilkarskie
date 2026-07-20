ALTER TABLE "AnalysisStrategyVersion"
ADD COLUMN "healthStatus" TEXT NOT NULL DEFAULT 'INSUFFICIENT_DATA',
ADD COLUMN "healthScore" INTEGER,
ADD COLUMN "healthReason" TEXT,
ADD COLUMN "healthEvaluatedAt" TIMESTAMP(3),
ADD COLUMN "minForwardSample" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "maxDrawdownPercent" DOUBLE PRECISION NOT NULL DEFAULT 15,
ADD COLUMN "maxLossPercent" DOUBLE PRECISION NOT NULL DEFAULT 10;

CREATE TABLE "StrategyHealthEvent" (
    "id" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "score" INTEGER,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyHealthEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ASV_user_health_eval_idx"
ON "AnalysisStrategyVersion"("userId", "healthStatus", "healthEvaluatedAt");

CREATE INDEX "StrategyHealthEvent_strategyVersionId_createdAt_idx"
ON "StrategyHealthEvent"("strategyVersionId", "createdAt");

CREATE INDEX "StrategyHealthEvent_userId_createdAt_idx"
ON "StrategyHealthEvent"("userId", "createdAt");

ALTER TABLE "StrategyHealthEvent"
ADD CONSTRAINT "StrategyHealthEvent_strategyVersionId_fkey"
FOREIGN KEY ("strategyVersionId") REFERENCES "AnalysisStrategyVersion"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StrategyHealthEvent"
ADD CONSTRAINT "StrategyHealthEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
