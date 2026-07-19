CREATE TABLE "MatchFieldObservation" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "importRowId" TEXT,
    "fieldName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "conflict" BOOLEAN NOT NULL DEFAULT false,
    "ignoredByOverride" BOOLEAN NOT NULL DEFAULT false,
    "sourceExternalId" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchFieldObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchFieldObservation_matchId_fieldName_dataSourceId_key"
ON "MatchFieldObservation"("matchId", "fieldName", "dataSourceId");

CREATE INDEX "MatchFieldObservation_matchId_conflict_active_idx"
ON "MatchFieldObservation"("matchId", "conflict", "active");

CREATE INDEX "MatchFieldObservation_dataSourceId_fieldName_idx"
ON "MatchFieldObservation"("dataSourceId", "fieldName");

ALTER TABLE "MatchFieldObservation"
ADD CONSTRAINT "MatchFieldObservation_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchFieldObservation"
ADD CONSTRAINT "MatchFieldObservation_dataSourceId_fkey"
FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MatchFieldObservation"
ADD CONSTRAINT "MatchFieldObservation_importRowId_fkey"
FOREIGN KEY ("importRowId") REFERENCES "ImportRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "MatchFieldObservation" (
    "id", "matchId", "dataSourceId", "fieldName", "value",
    "active", "conflict", "ignoredByOverride",
    "sourceExternalId", "sourceUpdatedAt", "observedAt", "createdAt", "updatedAt"
)
SELECT
    'mfo_' || md5(valueset."matchId" || ':' || valueset."fieldName" || ':' || valueset."dataSourceId"),
    valueset."matchId",
    valueset."dataSourceId",
    valueset."fieldName",
    valueset."value",
    true,
    false,
    false,
    valueset."sourceExternalId",
    valueset."sourceUpdatedAt",
    COALESCE(valueset."sourceUpdatedAt", valueset."matchUpdatedAt"),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT m."id" AS "matchId", m."dataSourceId", 'homeScore' AS "fieldName",
           m."homeScore"::text AS "value", m."sourceExternalId", m."sourceUpdatedAt",
           m."updatedAt" AS "matchUpdatedAt"
    FROM "Match" m WHERE m."dataSourceId" IS NOT NULL AND m."homeScore" IS NOT NULL
    UNION ALL
    SELECT m."id", m."dataSourceId", 'awayScore', m."awayScore"::text,
           m."sourceExternalId", m."sourceUpdatedAt", m."updatedAt"
    FROM "Match" m WHERE m."dataSourceId" IS NOT NULL AND m."awayScore" IS NOT NULL
    UNION ALL
    SELECT m."id", m."dataSourceId", 'refereeId', m."refereeId"::text,
           m."sourceExternalId", m."sourceUpdatedAt", m."updatedAt"
    FROM "Match" m WHERE m."dataSourceId" IS NOT NULL AND m."refereeId" IS NOT NULL
    UNION ALL
    SELECT m."id", m."dataSourceId", stat."fieldName", stat."value",
           m."sourceExternalId", m."sourceUpdatedAt", m."updatedAt"
    FROM "Match" m
    JOIN "MatchStats" s ON s."matchId" = m."id"
    CROSS JOIN LATERAL (
      VALUES
        ('homeCorners', s."homeCorners"::text),
        ('awayCorners', s."awayCorners"::text),
        ('homeYellowCards', s."homeYellowCards"::text),
        ('awayYellowCards', s."awayYellowCards"::text),
        ('homeRedCards', s."homeRedCards"::text),
        ('awayRedCards', s."awayRedCards"::text),
        ('homeShotsOnTarget', s."homeShotsOnTarget"::text),
        ('awayShotsOnTarget', s."awayShotsOnTarget"::text),
        ('homeShots', s."homeShots"::text),
        ('awayShots', s."awayShots"::text),
        ('homeFouls', s."homeFouls"::text),
        ('awayFouls', s."awayFouls"::text),
        ('homeOffsides', s."homeOffsides"::text),
        ('awayOffsides', s."awayOffsides"::text)
    ) AS stat("fieldName", "value")
    WHERE m."dataSourceId" IS NOT NULL AND stat."value" IS NOT NULL
) AS valueset
ON CONFLICT ("matchId", "fieldName", "dataSourceId") DO NOTHING;
