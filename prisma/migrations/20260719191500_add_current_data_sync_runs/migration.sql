-- CreateEnum
CREATE TYPE "CurrentDataSyncTrigger" AS ENUM ('MANUAL', 'CRON');

-- CreateEnum
CREATE TYPE "CurrentDataSyncRunStatus" AS ENUM ('PREPARING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "CurrentDataSyncRun" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "batchId" TEXT,
    "rangeFrom" TIMESTAMP(3) NOT NULL,
    "rangeTo" TIMESTAMP(3) NOT NULL,
    "trigger" "CurrentDataSyncTrigger" NOT NULL,
    "status" "CurrentDataSyncRunStatus" NOT NULL DEFAULT 'PREPARING',
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSelectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrentDataSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrentDataSyncLock" (
    "id" TEXT NOT NULL,
    "lockToken" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrentDataSyncLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CurrentDataSyncRun_seasonId_lastSelectedAt_idx" ON "CurrentDataSyncRun"("seasonId", "lastSelectedAt");

-- CreateIndex
CREATE INDEX "CurrentDataSyncRun_seasonId_rangeFrom_rangeTo_idx" ON "CurrentDataSyncRun"("seasonId", "rangeFrom", "rangeTo");

-- CreateIndex
CREATE INDEX "CurrentDataSyncRun_status_updatedAt_idx" ON "CurrentDataSyncRun"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "CurrentDataSyncRun" ADD CONSTRAINT "CurrentDataSyncRun_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentDataSyncRun" ADD CONSTRAINT "CurrentDataSyncRun_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
