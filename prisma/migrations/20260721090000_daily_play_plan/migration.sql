CREATE TABLE "DailyPlayPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "bankroll" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "maxDailyStakePercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "maxMatchStakePercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "maxLeagueStakePercent" DOUBLE PRECISION NOT NULL DEFAULT 7.5,
    "maxMarketStakePercent" DOUBLE PRECISION NOT NULL DEFAULT 7.5,
    "note" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPlayPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyPlayPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "analysisPickId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SELECTED',
    "priority" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "plannedStake" DOUBLE PRECISION,
    "oddsSnapshot" DOUBLE PRECISION,
    "bookmakerSnapshot" TEXT,
    "reason" TEXT,
    "playedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPlayPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyPlayPlanEvent" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyPlayPlanEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyPlayPlan_userId_planDate_key"
ON "DailyPlayPlan"("userId", "planDate");

CREATE INDEX "DailyPlayPlan_userId_status_planDate_idx"
ON "DailyPlayPlan"("userId", "status", "planDate");

CREATE UNIQUE INDEX "DailyPlayPlanItem_planId_analysisPickId_key"
ON "DailyPlayPlanItem"("planId", "analysisPickId");

CREATE INDEX "DailyPlayPlanItem_analysisPickId_idx"
ON "DailyPlayPlanItem"("analysisPickId");

CREATE INDEX "DailyPlayPlanItem_planId_status_createdAt_idx"
ON "DailyPlayPlanItem"("planId", "status", "createdAt");

CREATE INDEX "DailyPlayPlanEvent_planId_createdAt_idx"
ON "DailyPlayPlanEvent"("planId", "createdAt");

CREATE INDEX "DailyPlayPlanEvent_userId_createdAt_idx"
ON "DailyPlayPlanEvent"("userId", "createdAt");

ALTER TABLE "DailyPlayPlan"
ADD CONSTRAINT "DailyPlayPlan_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyPlayPlanItem"
ADD CONSTRAINT "DailyPlayPlanItem_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "DailyPlayPlan"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyPlayPlanItem"
ADD CONSTRAINT "DailyPlayPlanItem_analysisPickId_fkey"
FOREIGN KEY ("analysisPickId") REFERENCES "AnalysisPick"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyPlayPlanEvent"
ADD CONSTRAINT "DailyPlayPlanEvent_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "DailyPlayPlan"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyPlayPlanEvent"
ADD CONSTRAINT "DailyPlayPlanEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
