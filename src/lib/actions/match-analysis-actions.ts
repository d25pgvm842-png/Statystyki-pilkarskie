"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditEntityType } from "@/generated/prisma/enums";
import { requireWriteUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { valueToString } from "@/lib/utils";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function safeReturnPath(formData: FormData, matchId: string) {
  const value = text(formData, "returnTo");
  if (value.startsWith("/analysis")) return value;
  return `/analysis?matchId=${encodeURIComponent(matchId)}`;
}

export async function saveMatchAnalysisNoteAction(formData: FormData) {
  const user = await requireWriteUser();
  const matchId = text(formData, "matchId");
  const content = text(formData, "note");
  if (!matchId) redirect("/analysis");
  if (content.length > 4000) throw new Error("Notatka może mieć maksymalnie 4000 znaków.");

  const [match, existing] = await Promise.all([
    prisma.match.findUnique({ where: { id: matchId }, select: { id: true } }),
    prisma.matchAnalysisNote.findUnique({
      where: { matchId_userId: { matchId, userId: user.id } },
      select: { content: true },
    }),
  ]);
  if (!match) redirect("/analysis?error=match");

  const previous = existing?.content ?? null;
  const next = content || null;
  if (previous !== next) {
    await prisma.$transaction(async (tx) => {
      if (next === null) {
        await tx.matchAnalysisNote.deleteMany({ where: { matchId, userId: user.id } });
      } else {
        await tx.matchAnalysisNote.upsert({
          where: { matchId_userId: { matchId, userId: user.id } },
          update: { content: next },
          create: { matchId, userId: user.id, content: next },
        });
      }
      await tx.auditLog.create({
        data: {
          entityType: AuditEntityType.MATCH,
          entityId: matchId,
          action: "UPDATE_ANALYSIS_NOTE",
          userId: user.id,
          changes: {
            create: {
              fieldName: "analysisNote",
              oldValue: valueToString(previous),
              newValue: valueToString(next),
            },
          },
        },
      });
    });
  }

  revalidatePath("/analysis");
  const returnTo = safeReturnPath(formData, matchId);
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}saved=1`);
}
