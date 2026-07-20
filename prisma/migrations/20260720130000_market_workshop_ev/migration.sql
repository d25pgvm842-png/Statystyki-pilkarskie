-- AlterTable
ALTER TABLE "AnalysisPick"
ADD COLUMN "selectedTeamId" TEXT,
ADD COLUMN "rawProjection" DOUBLE PRECISION,
ADD COLUMN "adjustedProjection" DOUBLE PRECISION,
ADD COLUMN "oppositeOdds" DOUBLE PRECISION,
ADD COLUMN "quoteCapturedAt" TIMESTAMP(3),
ADD COLUMN "modelProbability" DOUBLE PRECISION,
ADD COLUMN "fairOdds" DOUBLE PRECISION,
ADD COLUMN "bookmakerMargin" DOUBLE PRECISION,
ADD COLUMN "marketProbability" DOUBLE PRECISION,
ADD COLUMN "expectedValue" DOUBLE PRECISION,
ADD COLUMN "modelSample" INTEGER,
ADD COLUMN "modelCoverage" DOUBLE PRECISION,
ADD COLUMN "modelConfidence" TEXT,
ADD COLUMN "marketStatus" TEXT,
ADD COLUMN "modelVersion" TEXT;

-- CreateIndex
CREATE INDEX "AnalysisPick_selectedTeamId_idx" ON "AnalysisPick"("selectedTeamId");

-- AddForeignKey
ALTER TABLE "AnalysisPick"
ADD CONSTRAINT "AnalysisPick_selectedTeamId_fkey"
FOREIGN KEY ("selectedTeamId") REFERENCES "Team"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
