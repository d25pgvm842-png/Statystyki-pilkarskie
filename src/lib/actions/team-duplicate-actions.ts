"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditEntityType, ExternalEntityType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type TransactionClient = Prisma.TransactionClient;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function resultHref(seasonId: string, flag: string) {
  const params = new URLSearchParams();
  if (seasonId) params.set("seasonId", seasonId);
  params.set(flag, "1");
  return `/automation/team-duplicates?${params.toString()}`;
}

async function advisoryLock(tx: TransactionClient, key: string) {
  await tx.$queryRaw<Array<{ lock: string | null }>>`
    SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS "lock"
  `;
}

function matchKey(input: {
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: Date;
}) {
  return `${input.seasonId}:${input.homeTeamId}:${input.awayTeamId}:${input.kickoffAt.toISOString()}`;
}

export async function mergeDuplicateTeamAction(formData: FormData) {
  const user = await requireAdminUser();

  const sourceTeamId = text(formData, "sourceTeamId");
  const targetTeamId = text(formData, "targetTeamId");
  const seasonId = text(formData, "seasonId");
  const confirmed = text(formData, "confirmed") === "yes";

  if (!sourceTeamId || !targetTeamId || sourceTeamId === targetTeamId) {
    redirect(resultHref(seasonId, "error-team"));
  }
  if (!confirmed) redirect(resultHref(seasonId, "error-confirm"));

  try {
    await prisma.$transaction(async (tx) => {
      const lockIds = [sourceTeamId, targetTeamId].sort();
      await advisoryLock(tx, `team-merge:${lockIds.join(":")}`);

      const [source, target] = await Promise.all([
        tx.team.findUnique({
          where: { id: sourceTeamId },
          include: {
            seasonMemberships: { include: { season: { select: { leagueId: true } } } },
          },
        }),
        tx.team.findUnique({
          where: { id: targetTeamId },
          include: {
            seasonMemberships: { include: { season: { select: { leagueId: true } } } },
          },
        }),
      ]);

      if (!source || !target) throw new Error("MERGE_TEAM_NOT_FOUND");

      const sourceLeagues = new Set(source.seasonMemberships.map((item) => item.season.leagueId));
      const sharedLeague = target.seasonMemberships.some((item) => sourceLeagues.has(item.season.leagueId));
      if (!sharedLeague) throw new Error("MERGE_DIFFERENT_LEAGUES");

      const [sourceMatches, targetMatches, sourceMappings] = await Promise.all([
        tx.match.findMany({
          where: { OR: [{ homeTeamId: source.id }, { awayTeamId: source.id }] },
          select: {
            id: true,
            seasonId: true,
            kickoffAt: true,
            homeTeamId: true,
            awayTeamId: true,
          },
        }),
        tx.match.findMany({
          where: { OR: [{ homeTeamId: target.id }, { awayTeamId: target.id }] },
          select: {
            id: true,
            seasonId: true,
            kickoffAt: true,
            homeTeamId: true,
            awayTeamId: true,
          },
        }),
        tx.externalMapping.findMany({
          where: {
            entityType: ExternalEntityType.TEAM,
            internalId: source.id,
          },
        }),
      ]);

      const targetMatchKeys = new Map(targetMatches.map((match) => [matchKey(match), match.id]));
      for (const match of sourceMatches) {
        const homeTeamId = match.homeTeamId === source.id ? target.id : match.homeTeamId;
        const awayTeamId = match.awayTeamId === source.id ? target.id : match.awayTeamId;
        if (homeTeamId === awayTeamId) throw new Error("MERGE_SAME_TEAM_MATCH");
        const collision = targetMatchKeys.get(matchKey({ ...match, homeTeamId, awayTeamId }));
        if (collision && collision !== match.id) throw new Error("MERGE_MATCH_COLLISION");
      }

      for (const mapping of sourceMappings) {
        const targetMapping = await tx.externalMapping.findFirst({
          where: {
            providerCode: mapping.providerCode,
            entityType: ExternalEntityType.TEAM,
            internalId: target.id,
          },
        });
        if (targetMapping && targetMapping.externalId !== mapping.externalId) {
          throw new Error("MERGE_MAPPING_COLLISION");
        }
      }

      for (const membership of source.seasonMemberships) {
        await tx.seasonTeam.upsert({
          where: {
            seasonId_teamId: {
              seasonId: membership.seasonId,
              teamId: target.id,
            },
          },
          update: {},
          create: {
            seasonId: membership.seasonId,
            teamId: target.id,
          },
        });
      }

      await tx.match.updateMany({
        where: { homeTeamId: source.id },
        data: { homeTeamId: target.id },
      });
      await tx.match.updateMany({
        where: { awayTeamId: source.id },
        data: { awayTeamId: target.id },
      });

      let mappingsMoved = 0;
      for (const mapping of sourceMappings) {
        const targetMapping = await tx.externalMapping.findFirst({
          where: {
            providerCode: mapping.providerCode,
            entityType: ExternalEntityType.TEAM,
            internalId: target.id,
          },
        });
        if (targetMapping) {
          await tx.externalMapping.delete({ where: { id: mapping.id } });
        } else {
          await tx.externalMapping.update({
            where: { id: mapping.id },
            data: { internalId: target.id },
          });
          mappingsMoved += 1;
        }
      }

      await tx.seasonTeam.deleteMany({ where: { teamId: source.id } });
      await tx.team.update({ where: { id: target.id }, data: { active: true } });

      await tx.auditLog.create({
        data: {
          entityType: AuditEntityType.TEAM,
          entityId: target.id,
          action: "MERGE_DUPLICATE_TEAM",
          userId: user.id,
          changes: {
            create: [
              { fieldName: "sourceTeamId", oldValue: source.id, newValue: target.id },
              { fieldName: "sourceTeamName", oldValue: source.name, newValue: target.name },
              { fieldName: "matchesMoved", oldValue: null, newValue: String(sourceMatches.length) },
              { fieldName: "seasonsMerged", oldValue: null, newValue: String(source.seasonMemberships.length) },
              { fieldName: "mappingsMoved", oldValue: null, newValue: String(mappingsMoved) },
            ],
          },
        },
      });

      await tx.team.delete({ where: { id: source.id } });
    }, { maxWait: 10_000, timeout: 30_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const flag = message === "MERGE_MATCH_COLLISION" ? "error-match"
      : message === "MERGE_MAPPING_COLLISION" ? "error-mapping"
      : message === "MERGE_DIFFERENT_LEAGUES" ? "error-league"
      : message === "MERGE_SAME_TEAM_MATCH" ? "error-opponents"
      : "error-unknown";
    redirect(resultHref(seasonId, flag));
  }

  revalidatePath("/teams");
  revalidatePath("/matches");
  revalidatePath("/automation");
  revalidatePath("/automation/team-duplicates");
  redirect(resultHref(seasonId, "merged"));
}
