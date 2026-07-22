ALTER TABLE "DailyPlayPlanItem"
  ADD COLUMN "skipReasonCode" TEXT,
  ADD COLUMN "skipNote" TEXT,
  ADD COLUMN "skippedAt" TIMESTAMP(3);
