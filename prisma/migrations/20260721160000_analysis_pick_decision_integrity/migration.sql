CREATE TYPE "AnalysisDecisionTiming" AS ENUM ('PRE_MATCH', 'LATE', 'UNKNOWN');

ALTER TABLE "AnalysisPick"
ADD COLUMN "decisionAt" TIMESTAMP(3),
ADD COLUMN "decisionTiming" "AnalysisDecisionTiming" NOT NULL DEFAULT 'UNKNOWN';

UPDATE "AnalysisPick" AS pick
SET
  "decisionAt" = COALESCE(pick."quoteCapturedAt", pick."createdAt"),
  "decisionTiming" = CASE
    WHEN COALESCE(pick."quoteCapturedAt", pick."createdAt") < match."kickoffAt"
      THEN 'PRE_MATCH'::"AnalysisDecisionTiming"
    ELSE 'LATE'::"AnalysisDecisionTiming"
  END
FROM "Match" AS match
WHERE match."id" = pick."matchId";

ALTER TABLE "AnalysisPick"
ALTER COLUMN "decisionAt" SET NOT NULL,
ALTER COLUMN "decisionAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "AnalysisPick_userId_decisionTiming_decisionAt_idx"
ON "AnalysisPick"("userId", "decisionTiming", "decisionAt");
