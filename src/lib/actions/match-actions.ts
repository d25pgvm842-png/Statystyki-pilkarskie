"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditEntityType, DataSourceType } from "@/generated/prisma/enums";
import { DELETE_MATCH_CONFIRMATION, isDeleteMatchConfirmationValid } from "@/lib/backup/delete-confirmation";
import { requireUser, requireWriteUser } from "@/lib/auth";
import { canAdminister } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { valueToString } from "@/lib/utils";
import { matchFormSchema, type MatchFormData } from "@/lib/validation/match";

export type MatchActionState = {
  message?: string;
  errors?: Record<string, string[]>;
};

const statFields = [
  "homeCorners", "awayCorners", "homeYellowCards", "awayYellowCards",
  "homeRedCards", "awayRedCards", "homeShotsOnTarget", "awayShotsOnTarget",
  "homeShots", "awayShots", "homeFouls", "awayFouls", "homeOffsides", "awayOffsides",
] as const;

function objectFromForm(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function statsData(data: MatchFormData) {
  return Object.fromEntries(statFields.map((field) => [field, data[field]]));
}

async function validateRelations(data: MatchFormData, editingId?: string) {
  const memberships = await prisma.seasonTeam.count({
    where: { seasonId: data.seasonId, teamId: { in: [data.homeTeamId, data.awayTeamId] } },
  });
  if (memberships !== 2) return "Obie drużyny muszą należeć do wybranego sezonu.";

  if (data.refereeId) {
    const assignment = await prisma.refereeSeason.findUnique({
      where: { refereeId_seasonId: { refereeId: data.refereeId, seasonId: data.seasonId } },
    });
    if (!assignment) return "Sędzia nie jest przypisany do wybranego sezonu.";
  }

  const duplicate = await prisma.match.findFirst({
    where: {
      seasonId: data.seasonId,
      homeTeamId: data.homeTeamId,
      awayTeamId: data.awayTeamId,
      kickoffAt: data.kickoffAt,
      ...(editingId ? { id: { not: editingId } } : {}),
    },
  });
  if (duplicate) return "Taki mecz już istnieje.";
  return null;
}

export async function createMatchAction(_: MatchActionState, formData: FormData): Promise<MatchActionState> {
  const user = await requireWriteUser();
  const parsed = matchFormSchema.safeParse(objectFromForm(formData));
  if (!parsed.success) return { message: "Popraw oznaczone pola.", errors: parsed.error.flatten().fieldErrors };

  const relationError = await validateRelations(parsed.data);
  if (relationError) return { message: relationError };

  let createdMatchId: string | null = null;

  try {
    const manualSource = await prisma.dataSource.findFirst({ where: { type: DataSourceType.MANUAL } });
    await prisma.$transaction(async (tx) => {
      const match = await tx.match.create({
        data: {
          seasonId: parsed.data.seasonId,
          round: parsed.data.round,
          kickoffAt: parsed.data.kickoffAt,
          homeTeamId: parsed.data.homeTeamId,
          awayTeamId: parsed.data.awayTeamId,
          homeScore: parsed.data.homeScore,
          awayScore: parsed.data.awayScore,
          status: parsed.data.status,
          refereeId: parsed.data.refereeId,
          dataSourceId: manualSource?.id,
          note: parsed.data.note,
          stats: { create: statsData(parsed.data) },
        },
      });

      createdMatchId = match.id;

      const auditValues = {
        ...parsed.data,
        kickoffAt: parsed.data.kickoffAt.toISOString(),
      };
      await tx.auditLog.create({
        data: {
          entityType: AuditEntityType.MATCH,
          entityId: match.id,
          action: "CREATE",
          userId: user.id,
          changes: {
            create: Object.entries(auditValues).filter(([key]) => key !== "matchId").map(([fieldName, newValue]) => ({
              fieldName,
              oldValue: null,
              newValue: valueToString(newValue),
            })),
          },
        },
      });
    });
  } catch {
    return { message: "Nie udało się zapisać meczu. Sprawdź połączenie z bazą i dane." };
  }

  revalidatePath("/");
  revalidatePath("/matches");
  if (!createdMatchId) return { message: "Mecz zapisano, ale nie udało się odczytać jego identyfikatora." };
  redirect(`/matches/${createdMatchId}`);
}

export async function updateMatchAction(_: MatchActionState, formData: FormData): Promise<MatchActionState> {
  const user = await requireWriteUser();
  const parsed = matchFormSchema.safeParse(objectFromForm(formData));
  if (!parsed.success) return { message: "Popraw oznaczone pola.", errors: parsed.error.flatten().fieldErrors };
  if (!parsed.data.matchId) return { message: "Brak identyfikatora meczu." };

  const relationError = await validateRelations(parsed.data, parsed.data.matchId);
  if (relationError) return { message: relationError };

  const existing = await prisma.match.findUnique({ where: { id: parsed.data.matchId }, include: { stats: true } });
  if (!existing) return { message: "Mecz nie istnieje." };

  const oldValues: Record<string, unknown> = {
    seasonId: existing.seasonId,
    round: existing.round,
    kickoffAt: existing.kickoffAt,
    homeTeamId: existing.homeTeamId,
    awayTeamId: existing.awayTeamId,
    homeScore: existing.homeScore,
    awayScore: existing.awayScore,
    status: existing.status,
    refereeId: existing.refereeId,
    note: existing.note,
    ...Object.fromEntries(statFields.map((field) => [field, existing.stats?.[field] ?? null])),
  };
  const newValues: Record<string, unknown> = {
    seasonId: parsed.data.seasonId,
    round: parsed.data.round,
    kickoffAt: parsed.data.kickoffAt,
    homeTeamId: parsed.data.homeTeamId,
    awayTeamId: parsed.data.awayTeamId,
    homeScore: parsed.data.homeScore,
    awayScore: parsed.data.awayScore,
    status: parsed.data.status,
    refereeId: parsed.data.refereeId,
    note: parsed.data.note,
    ...statsData(parsed.data),
  };
  const changes = Object.keys(newValues).filter((key) => valueToString(oldValues[key]) !== valueToString(newValues[key]));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: parsed.data.matchId },
        data: {
          seasonId: parsed.data.seasonId,
          round: parsed.data.round,
          kickoffAt: parsed.data.kickoffAt,
          homeTeamId: parsed.data.homeTeamId,
          awayTeamId: parsed.data.awayTeamId,
          homeScore: parsed.data.homeScore,
          awayScore: parsed.data.awayScore,
          status: parsed.data.status,
          refereeId: parsed.data.refereeId,
          note: parsed.data.note,
          stats: { upsert: { create: statsData(parsed.data), update: statsData(parsed.data) } },
        },
      });

      if (changes.length) {
        await tx.auditLog.create({
          data: {
            entityType: AuditEntityType.MATCH,
            entityId: parsed.data.matchId!,
            action: "UPDATE",
            userId: user.id,
            changes: { create: changes.map((fieldName) => ({
              fieldName,
              oldValue: valueToString(oldValues[fieldName]),
              newValue: valueToString(newValues[fieldName]),
            })) },
          },
        });

        await Promise.all(changes.map((fieldName) => tx.dataOverride.upsert({
          where: { matchId_fieldName: { matchId: parsed.data.matchId!, fieldName } },
          update: { createdById: user.id },
          create: { matchId: parsed.data.matchId!, fieldName, createdById: user.id, reason: "Ręczna edycja" },
        })));
      }
    });
  } catch {
    return { message: "Nie udało się zaktualizować meczu." };
  }

  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath(`/matches/${parsed.data.matchId}`);
  revalidatePath(`/matches/${parsed.data.matchId}/edit`);
  redirect(`/matches/${parsed.data.matchId}`);
}


export async function deleteMatchAction(_: MatchActionState, formData: FormData): Promise<MatchActionState> {
  const user = await requireUser();
  if (!canAdminister(user.role)) return { message: "Tylko administrator może usuwać mecze." };

  const matchId = String(formData.get("matchId") ?? "").trim();
  if (!matchId) return { message: "Brak identyfikatora meczu." };

  if (!isDeleteMatchConfirmationValid(formData.get("confirmation"))) {
    return { message: `Wpisz dokładnie: ${DELETE_MATCH_CONFIRMATION}` };
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      season: { include: { league: true } },
      homeTeam: true,
      awayTeam: true,
      referee: true,
      dataSource: true,
      stats: true,
    },
  });

  if (!match) return { message: "Mecz nie istnieje albo został już usunięty." };

  const snapshot: Record<string, unknown> = {
    matchLabel: `${match.homeTeam.name} – ${match.awayTeam.name}`,
    leagueSeason: `${match.season.league.name} · ${match.season.name}`,
    seasonId: match.seasonId,
    round: match.round,
    kickoffAt: match.kickoffAt,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status: match.status,
    refereeId: match.refereeId,
    refereeName: match.referee?.name ?? null,
    dataSource: match.dataSource?.name ?? null,
    sourceExternalId: match.sourceExternalId,
    note: match.note,
    ...Object.fromEntries(statFields.map((field) => [field, match.stats?.[field] ?? null])),
  };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          entityType: AuditEntityType.MATCH,
          entityId: match.id,
          action: "DELETE",
          userId: user.id,
          changes: {
            create: Object.entries(snapshot).map(([fieldName, newValue]) => ({
              fieldName,
              oldValue: null,
              newValue: valueToString(newValue),
            })),
          },
        },
      });

      await tx.match.delete({ where: { id: match.id } });
    });
  } catch {
    return { message: "Nie udało się usunąć meczu. Pobierz kopię danych i spróbuj ponownie." };
  }

  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/teams");
  revalidatePath("/referees");
  revalidatePath("/comparison");
  revalidatePath("/data-quality");
  revalidatePath("/data-management");
  redirect("/matches?deleted=1");
}
