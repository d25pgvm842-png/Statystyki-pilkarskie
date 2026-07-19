-- CreateTable
CREATE TABLE "MatchAnalysisNote" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchAnalysisNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchAnalysisNote_matchId_userId_key" ON "MatchAnalysisNote"("matchId", "userId");

-- CreateIndex
CREATE INDEX "MatchAnalysisNote_userId_updatedAt_idx" ON "MatchAnalysisNote"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "MatchAnalysisNote" ADD CONSTRAINT "MatchAnalysisNote_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchAnalysisNote" ADD CONSTRAINT "MatchAnalysisNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
