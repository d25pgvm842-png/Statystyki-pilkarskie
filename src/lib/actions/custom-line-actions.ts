"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LineScope } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TREND_STAT_DEFINITIONS } from "@/lib/stats/trends";

const validStats = new Set<string>(TREND_STAT_DEFINITIONS.map((item) => item.key));
const validScopes = new Set(Object.values(LineScope));

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function safeReturnTo(formData: FormData) {
  const value = text(formData, "returnTo");
  if (value.startsWith("/analysis")) return value;
  if (value.startsWith("/trends")) return value;
  return "/trends";
}

function returnPath(formData: FormData, flag: string) {
  const safe = safeReturnTo(formData);
  return `${safe}${safe.includes("?") ? "&" : "?"}${flag}=1`;
}

function revalidateAnalysisPages() {
  revalidatePath("/trends");
  revalidatePath("/analysis");
}

export async function createCustomLineAction(formData: FormData) {
  const user = await requireUser();
  const name = text(formData, "name");
  const statKey = text(formData, "statKey");
  const scope = text(formData, "scope");
  const threshold = Number(text(formData, "threshold"));

  if (!name || name.length > 80) throw new Error("Nazwa linii musi mieć od 1 do 80 znaków.");
  if (!validStats.has(statKey)) throw new Error("Nieprawidłowy rynek statystyczny.");
  if (!validScopes.has(scope as LineScope)) throw new Error("Nieprawidłowy zakres linii.");
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 500) {
    throw new Error("Linia musi być liczbą od 0 do 500.");
  }

  await prisma.customLine.create({
    data: {
      userId: user.id,
      name,
      statKey,
      scope: scope as LineScope,
      threshold,
    },
  });

  revalidateAnalysisPages();
  redirect(returnPath(formData, "created"));
}

export async function toggleCustomLineAction(formData: FormData) {
  const user = await requireUser();
  const id = text(formData, "id");
  const line = await prisma.customLine.findFirst({ where: { id, userId: user.id } });
  if (!line) throw new Error("Linia nie istnieje.");

  await prisma.customLine.update({ where: { id }, data: { active: !line.active } });
  revalidateAnalysisPages();
  redirect(returnPath(formData, "updated"));
}

export async function deleteCustomLineAction(formData: FormData) {
  const user = await requireUser();
  const id = text(formData, "id");
  await prisma.customLine.deleteMany({ where: { id, userId: user.id } });
  revalidateAnalysisPages();
  redirect(returnPath(formData, "deleted"));
}
