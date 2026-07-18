-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ANALYST', 'VIEWER');
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED');
CREATE TYPE "DataSourceType" AS ENUM ('MANUAL', 'CSV', 'XLSX', 'API');
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'VALIDATING', 'READY', 'COMPLETED', 'FAILED');
CREATE TYPE "ImportRowStatus" AS ENUM ('VALID', 'DUPLICATE', 'INVALID', 'IMPORTED', 'SKIPPED');
CREATE TYPE "AuditEntityType" AS ENUM ('MATCH', 'MATCH_STATS', 'TEAM', 'REFEREE', 'SEASON', 'LEAGUE');
CREATE TYPE "LineScope" AS ENUM ('MATCH_TOTAL', 'TEAM_FOR', 'TEAM_AGAINST');

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'ANALYST',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "League" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Season" (
  "id" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Team" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shortName" TEXT,
  "slug" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeasonTeam" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Referee" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Referee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefereeSeason" (
  "id" TEXT NOT NULL,
  "refereeId" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefereeSeason_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataSource" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "DataSourceType" NOT NULL,
  "providerCode" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Match" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "round" INTEGER,
  "kickoffAt" TIMESTAMP(3) NOT NULL,
  "homeTeamId" TEXT NOT NULL,
  "awayTeamId" TEXT NOT NULL,
  "homeScore" INTEGER,
  "awayScore" INTEGER,
  "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
  "refereeId" TEXT,
  "dataSourceId" TEXT,
  "sourceExternalId" TEXT,
  "sourceUpdatedAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchStats" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "homeCorners" INTEGER,
  "awayCorners" INTEGER,
  "homeYellowCards" INTEGER,
  "awayYellowCards" INTEGER,
  "homeRedCards" INTEGER,
  "awayRedCards" INTEGER,
  "homeShotsOnTarget" INTEGER,
  "awayShotsOnTarget" INTEGER,
  "homeShots" INTEGER,
  "awayShots" INTEGER,
  "homeFouls" INTEGER,
  "awayFouls" INTEGER,
  "homeOffsides" INTEGER,
  "awayOffsides" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MatchStats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataOverride" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "fieldName" TEXT NOT NULL,
  "reason" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportBatch" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
  "sourceId" TEXT,
  "createdById" TEXT NOT NULL,
  "rowsTotal" INTEGER NOT NULL DEFAULT 0,
  "rowsValid" INTEGER NOT NULL DEFAULT 0,
  "rowsInvalid" INTEGER NOT NULL DEFAULT 0,
  "rowsDuplicate" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportRow" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "status" "ImportRowStatus" NOT NULL,
  "rawData" JSONB NOT NULL,
  "errors" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "entityType" "AuditEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditChange" (
  "id" TEXT NOT NULL,
  "auditLogId" TEXT NOT NULL,
  "fieldName" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  CONSTRAINT "AuditChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomLine" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "statKey" TEXT NOT NULL,
  "scope" "LineScope" NOT NULL,
  "threshold" DOUBLE PRECISION NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "League_slug_key" ON "League"("slug");
CREATE UNIQUE INDEX "League_code_key" ON "League"("code");
CREATE UNIQUE INDEX "Season_leagueId_name_key" ON "Season"("leagueId", "name");
CREATE INDEX "Season_leagueId_active_idx" ON "Season"("leagueId", "active");
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");
CREATE UNIQUE INDEX "SeasonTeam_seasonId_teamId_key" ON "SeasonTeam"("seasonId", "teamId");
CREATE INDEX "SeasonTeam_teamId_idx" ON "SeasonTeam"("teamId");
CREATE UNIQUE INDEX "Referee_slug_key" ON "Referee"("slug");
CREATE UNIQUE INDEX "RefereeSeason_refereeId_seasonId_key" ON "RefereeSeason"("refereeId", "seasonId");
CREATE INDEX "RefereeSeason_seasonId_idx" ON "RefereeSeason"("seasonId");
CREATE UNIQUE INDEX "DataSource_providerCode_key" ON "DataSource"("providerCode");
CREATE UNIQUE INDEX "Match_seasonId_homeTeamId_awayTeamId_kickoffAt_key" ON "Match"("seasonId", "homeTeamId", "awayTeamId", "kickoffAt");
CREATE INDEX "Match_seasonId_kickoffAt_idx" ON "Match"("seasonId", "kickoffAt");
CREATE INDEX "Match_homeTeamId_kickoffAt_idx" ON "Match"("homeTeamId", "kickoffAt");
CREATE INDEX "Match_awayTeamId_kickoffAt_idx" ON "Match"("awayTeamId", "kickoffAt");
CREATE INDEX "Match_refereeId_idx" ON "Match"("refereeId");
CREATE UNIQUE INDEX "MatchStats_matchId_key" ON "MatchStats"("matchId");
CREATE UNIQUE INDEX "DataOverride_matchId_fieldName_key" ON "DataOverride"("matchId", "fieldName");
CREATE INDEX "DataOverride_createdById_idx" ON "DataOverride"("createdById");
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");
CREATE UNIQUE INDEX "ImportRow_importId_rowNumber_key" ON "ImportRow"("importId", "rowNumber");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "CustomLine_userId_statKey_idx" ON "CustomLine"("userId", "statKey");

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeasonTeam" ADD CONSTRAINT "SeasonTeam_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonTeam" ADD CONSTRAINT "SeasonTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefereeSeason" ADD CONSTRAINT "RefereeSeason_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "Referee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefereeSeason" ADD CONSTRAINT "RefereeSeason_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "Referee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MatchStats" ADD CONSTRAINT "MatchStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataOverride" ADD CONSTRAINT "DataOverride_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataOverride" ADD CONSTRAINT "DataOverride_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditChange" ADD CONSTRAINT "AuditChange_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomLine" ADD CONSTRAINT "CustomLine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
