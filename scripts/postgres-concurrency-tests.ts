import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL albo DATABASE_URL jest wymagany.");

const pool = new Pool({ connectionString: databaseUrl, max: 12 });
const runId = `h1253_${randomUUID().replaceAll("-", "")}`;
const id = (suffix: string) => `${runId}_${suffix}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function transaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function lock(client: PoolClient, resource: string, resourceId: string) {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    [`staty-pilkarskie:${resource}:${resourceId}`],
  );
}

async function seed() {
  const kickoff = new Date(Date.now() + 86_400_000);
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "active", "updatedAt")
       VALUES ($1, $2, 'CI Atomicity', 'not-a-real-password', 'ADMIN', true, NOW())`,
      [id("user"), `${runId}@example.invalid`],
    );
    await client.query(
      `INSERT INTO "League" ("id", "name", "slug", "country", "code", "updatedAt")
       VALUES ($1, 'CI League', $2, 'CI', $3, NOW())`,
      [id("league"), id("league_slug"), id("league_code")],
    );
    await client.query(
      `INSERT INTO "Season" ("id", "leagueId", "name", "startsAt", "endsAt", "active", "updatedAt")
       VALUES ($1, $2, 'CI Season', NOW() - INTERVAL '1 day', NOW() + INTERVAL '365 days', true, NOW())`,
      [id("season"), id("league")],
    );
    for (const team of ["home", "away"]) {
      await client.query(
        `INSERT INTO "Team" ("id", "name", "slug", "country", "active", "updatedAt")
         VALUES ($1, $2, $3, 'CI', true, NOW())`,
        [id(team), `CI ${team}`, id(`${team}_slug`)],
      );
      await client.query(
        `INSERT INTO "SeasonTeam" ("id", "seasonId", "teamId") VALUES ($1, $2, $3)`,
        [id(`membership_${team}`), id("season"), id(team)],
      );
    }
    await client.query(
      `INSERT INTO "Match" (
        "id", "seasonId", "round", "kickoffAt", "homeTeamId", "awayTeamId", "status", "updatedAt"
      ) VALUES ($1, $2, 1, $3, $4, $5, 'SCHEDULED', NOW())`,
      [id("match"), id("season"), kickoff, id("home"), id("away")],
    );
    await client.query(
      `INSERT INTO "MatchStats" ("id", "matchId", "homeCorners", "awayCorners", "updatedAt")
       VALUES ($1, $2, 6, 4, NOW())`,
      [id("stats"), id("match")],
    );
    await client.query(
      `INSERT INTO "AnalysisPick" (
        "id", "userId", "matchId", "fingerprint", "source", "statKey", "statLabel", "scope",
        "threshold", "side", "status", "decisionAt", "decisionTiming", "updatedAt"
      ) VALUES ($1, $2, $3, $4, 'MANUAL', 'corners', 'Rzuty rożne', 'MATCH_TOTAL', 9.5, 'OVER',
        'WATCHING', NOW(), 'PRE_MATCH', NOW())`,
      [id("pick"), id("user"), id("match"), id("fingerprint")],
    );
    await client.query(
      `INSERT INTO "DailyPlayPlan" (
        "id", "userId", "planDate", "status", "bankroll", "maxDailyStakePercent",
        "maxMatchStakePercent", "maxLeagueStakePercent", "maxMarketStakePercent", "updatedAt"
      ) VALUES ($1, $2, CURRENT_DATE, 'DRAFT', 1000, 10, 5, 7.5, 7.5, NOW())`,
      [id("plan"), id("user")],
    );
    await client.query(
      `INSERT INTO "DailyPlayPlanItem" (
        "id", "planId", "analysisPickId", "status", "priority", "score", "snapshot",
        "plannedStake", "oddsSnapshot", "bookmakerSnapshot", "updatedAt"
      ) VALUES ($1, $2, $3, 'SELECTED', 'TOP', 90, '{}'::jsonb, 10, 2.0, 'CI', NOW())`,
      [id("item"), id("plan"), id("pick")],
    );
  });
}

async function testApproveVsEdit() {
  const approve = transaction(async (client) => {
    await lock(client, "daily-play-plan", id("plan"));
    const current = await client.query<{ status: string }>(
      `SELECT "status" FROM "DailyPlayPlan" WHERE "id" = $1`,
      [id("plan")],
    );
    assert.equal(current.rows[0]?.status, "DRAFT");
    await sleep(100);
    await client.query(
      `UPDATE "DailyPlayPlan" SET "status" = 'APPROVED', "approvedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`,
      [id("plan")],
    );
    await client.query(
      `INSERT INTO "DailyPlayPlanEvent" ("id", "planId", "userId", "type", "details")
       VALUES ($1, $2, $3, 'APPROVE', '{}'::jsonb)`,
      [id("event_approve"), id("plan"), id("user")],
    );
    return true;
  });

  await sleep(10);
  const edit = transaction(async (client) => {
    await lock(client, "daily-play-plan", id("plan"));
    const current = await client.query<{ status: string }>(
      `SELECT "status" FROM "DailyPlayPlan" WHERE "id" = $1`,
      [id("plan")],
    );
    if (current.rows[0]?.status !== "DRAFT") return false;
    await client.query(
      `UPDATE "DailyPlayPlan" SET "bankroll" = 2000, "updatedAt" = NOW() WHERE "id" = $1`,
      [id("plan")],
    );
    return true;
  });

  const [approved, edited] = await Promise.all([approve, edit]);
  assert.equal(approved, true);
  assert.equal(edited, false);
  const state = await pool.query<{ status: string; bankroll: number }>(
    `SELECT "status", "bankroll" FROM "DailyPlayPlan" WHERE "id" = $1`,
    [id("plan")],
  );
  assert.equal(state.rows[0]?.status, "APPROVED");
  assert.equal(state.rows[0]?.bankroll, 1000);
}

async function playItemOnce(eventSuffix: string) {
  return transaction(async (client) => {
    await lock(client, "daily-play-plan", id("plan"));
    const current = await client.query<{ planStatus: string; itemStatus: string; pickStatus: string }>(
      `SELECT plan."status" AS "planStatus", item."status" AS "itemStatus", pick."status" AS "pickStatus"
       FROM "DailyPlayPlanItem" item
       JOIN "DailyPlayPlan" plan ON plan."id" = item."planId"
       JOIN "AnalysisPick" pick ON pick."id" = item."analysisPickId"
       WHERE item."id" = $1`,
      [id("item")],
    );
    const row = current.rows[0];
    if (!row || row.planStatus !== "APPROVED" || row.itemStatus !== "SELECTED") return false;
    await lock(client, "analysis-pick", id("pick"));
    const pick = await client.query<{ status: string }>(
      `SELECT "status" FROM "AnalysisPick" WHERE "id" = $1`,
      [id("pick")],
    );
    if (pick.rows[0]?.status !== "WATCHING" && pick.rows[0]?.status !== "PLAYED") return false;
    if (pick.rows[0]?.status === "WATCHING") {
      await client.query(
        `UPDATE "AnalysisPick" SET "status" = 'PLAYED', "odds" = 2, "stake" = 10, "placedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`,
        [id("pick")],
      );
    }
    await client.query(
      `UPDATE "DailyPlayPlanItem" SET "status" = 'PLAYED', "playedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`,
      [id("item")],
    );
    await client.query(
      `INSERT INTO "DailyPlayPlanEvent" ("id", "planId", "userId", "type", "details")
       VALUES ($1, $2, $3, 'PLAY_ITEM', '{}'::jsonb)`,
      [id(`event_play_${eventSuffix}`), id("plan"), id("user")],
    );
    return true;
  });
}

async function testDoublePlay() {
  const results = await Promise.all([playItemOnce("a"), playItemOnce("b")]);
  assert.deepEqual(results.sort(), [false, true]);
  const events = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS "count" FROM "DailyPlayPlanEvent" WHERE "planId" = $1 AND "type" = 'PLAY_ITEM'`,
    [id("plan")],
  );
  assert.equal(events.rows[0]?.count, "1");
}

async function resetPick(suffix: string) {
  const pickId = id(`pick_${suffix}`);
  await pool.query(
    `INSERT INTO "AnalysisPick" (
      "id", "userId", "matchId", "fingerprint", "source", "statKey", "statLabel", "scope",
      "threshold", "side", "status", "decisionAt", "decisionTiming", "placedAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, 'MANUAL', 'corners', 'Rzuty rożne', 'MATCH_TOTAL', 9.5, 'OVER',
      'PLAYED', NOW(), 'PRE_MATCH', NOW(), NOW())`,
    [pickId, id("user"), id("match"), id(`fingerprint_${suffix}`)],
  );
  return pickId;
}

async function autoSettleOnce(pickId: string, auditSuffix: string) {
  return transaction(async (client) => {
    await lock(client, "analysis-pick", pickId);
    const current = await client.query<{ status: string }>(
      `SELECT "status" FROM "AnalysisPick" WHERE "id" = $1`,
      [pickId],
    );
    if (current.rows[0]?.status !== "PLAYED") return false;
    await client.query(
      `UPDATE "AnalysisPick" SET "status" = 'SETTLED', "result" = 'WIN', "actualValue" = 10,
       "settledAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`,
      [pickId],
    );
    const auditId = id(`audit_${auditSuffix}`);
    await client.query(
      `INSERT INTO "AuditLog" ("id", "entityType", "entityId", "action", "userId")
       VALUES ($1, 'ANALYSIS_PICK', $2, 'AUTO_SETTLE_ANALYSIS_PICK', $3)`,
      [auditId, pickId, id("user")],
    );
    return true;
  });
}

async function testDoubleAutoSettle() {
  const pickId = await resetPick("double_auto");
  const results = await Promise.all([
    autoSettleOnce(pickId, "double_auto_a"),
    autoSettleOnce(pickId, "double_auto_b"),
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  const audits = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS "count" FROM "AuditLog" WHERE "entityId" = $1 AND "action" = 'AUTO_SETTLE_ANALYSIS_PICK'`,
    [pickId],
  );
  assert.equal(audits.rows[0]?.count, "1");
}

async function testManualWinsAgainstAuto() {
  const pickId = await resetPick("manual_auto");
  const manual = transaction(async (client) => {
    await lock(client, "analysis-pick", pickId);
    await sleep(100);
    await client.query(
      `UPDATE "AnalysisPick" SET "status" = 'SETTLED', "result" = 'LOSS', "actualValue" = 8,
       "settledAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`,
      [pickId],
    );
    return true;
  });
  await sleep(10);
  const auto = autoSettleOnce(pickId, "manual_auto");
  const [manualResult, autoResult] = await Promise.all([manual, auto]);
  assert.equal(manualResult, true);
  assert.equal(autoResult, false);
  const current = await pool.query<{ result: string; actualValue: number }>(
    `SELECT "result", "actualValue" FROM "AnalysisPick" WHERE "id" = $1`,
    [pickId],
  );
  assert.equal(current.rows[0]?.result, "LOSS");
  assert.equal(current.rows[0]?.actualValue, 8);
}

async function testManualOverrideWinsAgainstLegacyImport() {
  const manual = transaction(async (client) => {
    await lock(client, "match", id("match"));
    await client.query(`UPDATE "Match" SET "round" = 9, "updatedAt" = NOW() WHERE "id" = $1`, [id("match")]);
    await client.query(
      `INSERT INTO "DataOverride" ("id", "matchId", "fieldName", "reason", "createdById")
       VALUES ($1, $2, 'round', 'CI manual override', $3)`,
      [id("override_round"), id("match"), id("user")],
    );
    await sleep(100);
    return true;
  });
  await sleep(10);
  const legacyImport = transaction(async (client) => {
    await lock(client, "match", id("match"));
    const override = await client.query(
      `SELECT 1 FROM "DataOverride" WHERE "matchId" = $1 AND "fieldName" = 'round'`,
      [id("match")],
    );
    if (override.rowCount) return false;
    await client.query(`UPDATE "Match" SET "round" = 2, "updatedAt" = NOW() WHERE "id" = $1`, [id("match")]);
    return true;
  });
  const [manualResult, importResult] = await Promise.all([manual, legacyImport]);
  assert.equal(manualResult, true);
  assert.equal(importResult, false);
  const match = await pool.query<{ round: number }>(`SELECT "round" FROM "Match" WHERE "id" = $1`, [id("match")]);
  assert.equal(match.rows[0]?.round, 9);
}

async function cleanup() {
  await transaction(async (client) => {
    await client.query(`DELETE FROM "DailyPlayPlanEvent" WHERE "userId" = $1`, [id("user")]);
    await client.query(`DELETE FROM "DailyPlayPlanItem" WHERE "planId" = $1`, [id("plan")]);
    await client.query(`DELETE FROM "DailyPlayPlan" WHERE "id" = $1`, [id("plan")]);
    await client.query(`DELETE FROM "AuditChange" WHERE "auditLogId" IN (SELECT "id" FROM "AuditLog" WHERE "userId" = $1)`, [id("user")]);
    await client.query(`DELETE FROM "AuditLog" WHERE "userId" = $1`, [id("user")]);
    await client.query(`DELETE FROM "AnalysisPick" WHERE "userId" = $1`, [id("user")]);
    await client.query(`DELETE FROM "DataOverride" WHERE "createdById" = $1`, [id("user")]);
    await client.query(`DELETE FROM "MatchStats" WHERE "matchId" = $1`, [id("match")]);
    await client.query(`DELETE FROM "Match" WHERE "id" = $1`, [id("match")]);
    await client.query(`DELETE FROM "SeasonTeam" WHERE "seasonId" = $1`, [id("season")]);
    await client.query(`DELETE FROM "Team" WHERE "id" IN ($1, $2)`, [id("home"), id("away")]);
    await client.query(`DELETE FROM "Season" WHERE "id" = $1`, [id("season")]);
    await client.query(`DELETE FROM "League" WHERE "id" = $1`, [id("league")]);
    await client.query(`DELETE FROM "User" WHERE "id" = $1`, [id("user")]);
  });
}

async function main() {
  try {
    await seed();
    await testApproveVsEdit();
    await testDoublePlay();
    await testDoubleAutoSettle();
    await testManualWinsAgainstAuto();
    await testManualOverrideWinsAgainstLegacyImport();
    console.log("PostgreSQL atomicity E2E: 5/5 PASS");
  } finally {
    try {
      await cleanup();
    } finally {
      await pool.end();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
