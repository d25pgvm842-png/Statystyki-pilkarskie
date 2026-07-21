"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/auth";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function requireAdmin() {
  const user = await requireAdminUser();
  return user;
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createLeagueAction(formData: FormData) {
  await requireAdmin();
  const name = text(formData, "name");
  const country = text(formData, "country");
  const code = text(formData, "code").toUpperCase();
  if (!name || !country || !code) throw new Error("Uzupełnij nazwę, kraj i kod ligi.");

  await prisma.league.create({ data: { name, country, code, slug: slugify(name) } });
  revalidatePath("/settings");
  redirect("/settings?ok=league");
}

export async function createSeasonAction(formData: FormData) {
  await requireAdmin();
  const leagueId = text(formData, "leagueId");
  const name = text(formData, "name");
  const startsAt = new Date(text(formData, "startsAt"));
  const endsAt = new Date(text(formData, "endsAt"));
  if (!leagueId || !name || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new Error("Uzupełnij poprawnie dane sezonu.");
  if (endsAt <= startsAt) throw new Error("Koniec sezonu musi być później niż początek.");

  await prisma.$transaction(async (tx) => {
    if (formData.get("active") === "on") {
      await tx.season.updateMany({ where: { leagueId }, data: { active: false } });
    }
    await tx.season.create({ data: { leagueId, name, startsAt, endsAt, active: formData.get("active") === "on" } });
  });
  revalidatePath("/settings");
  redirect("/settings?ok=season");
}

export async function createTeamAction(formData: FormData) {
  await requireAdmin();
  const name = text(formData, "name");
  const shortName = text(formData, "shortName") || null;
  const country = text(formData, "country");
  const seasonId = text(formData, "seasonId");
  if (!name || !country || !seasonId) throw new Error("Uzupełnij nazwę, kraj i sezon drużyny.");

  const team = await prisma.team.upsert({
    where: { slug: slugify(name) },
    update: { name, shortName, country, active: true },
    create: { name, shortName, country, slug: slugify(name) },
  });
  await prisma.seasonTeam.upsert({
    where: { seasonId_teamId: { seasonId, teamId: team.id } },
    update: {},
    create: { seasonId, teamId: team.id },
  });
  revalidatePath("/settings");
  revalidatePath("/teams");
  redirect("/settings?ok=team");
}

export async function createRefereeAction(formData: FormData) {
  await requireAdmin();
  const name = text(formData, "name");
  const seasonId = text(formData, "seasonId");
  if (!name || !seasonId) throw new Error("Uzupełnij nazwę sędziego i sezon.");

  const referee = await prisma.referee.upsert({
    where: { slug: slugify(name) },
    update: { name, active: true },
    create: { name, slug: slugify(name) },
  });
  await prisma.refereeSeason.upsert({
    where: { refereeId_seasonId: { refereeId: referee.id, seasonId } },
    update: {},
    create: { refereeId: referee.id, seasonId },
  });
  revalidatePath("/settings");
  revalidatePath("/referees");
  redirect("/settings?ok=referee");
}

export async function toggleLeagueAction(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  const active = text(formData, "active") === "true";
  await prisma.league.update({ where: { id }, data: { active: !active } });
  revalidatePath("/settings");
}

export async function setActiveSeasonAction(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  const season = await prisma.season.findUnique({ where: { id }, select: { leagueId: true } });
  if (!season) throw new Error("Sezon nie istnieje.");

  await prisma.$transaction([
    prisma.season.updateMany({ where: { leagueId: season.leagueId }, data: { active: false } }),
    prisma.season.update({ where: { id }, data: { active: true } }),
  ]);

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/matches");
  revalidatePath("/teams");
  revalidatePath("/referees");
  revalidatePath("/comparison");
  revalidatePath("/imports");
}

export async function toggleTeamAction(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  const active = text(formData, "active") === "true";
  await prisma.team.update({ where: { id }, data: { active: !active } });
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/teams");
  revalidatePath("/matches");
}

export async function toggleRefereeAction(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  const active = text(formData, "active") === "true";
  await prisma.referee.update({ where: { id }, data: { active: !active } });
  revalidatePath("/settings");
  revalidatePath("/referees");
  revalidatePath("/matches");
}

