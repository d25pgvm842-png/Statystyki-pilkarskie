"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditEntityType } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { evaluateAndPersistStrategyHealth } from "@/lib/data/strategy-monitoring";
import { prisma } from "@/lib/db";
import { valueToString } from "@/lib/utils";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function numberField(
  formData: FormData,
  name: string,
  input: { min: number; max: number },
) {
  const raw = text(formData, name).replace(",", ".");
  const value = Number(raw);
  if (!Number.isFinite(value) || value < input.min || value > input.max) {
    throw new Error(`Nieprawidłowa wartość pola ${name}.`);
  }
  return value;
}

function revalidateMonitoringPaths() {
  revalidatePath("/monitoring");
  revalidatePath("/portfolio");
  revalidatePath("/strategies");
}

export async function refreshStrategyHealthAction(formData: FormData) {
  const user = await requireUser();
  const versionId = text(formData, "versionId");
  if (!versionId) redirect("/monitoring?error=missing");

  const version = await prisma.analysisStrategyVersion.findFirst({
    where: { id: versionId, userId: user.id },
    select: { id: true },
  });
  if (!version) redirect("/monitoring?error=missing");

  const result = await evaluateAndPersistStrategyHealth({
    userId: user.id,
    versionId,
    source: "MANUAL",
  });
  revalidateMonitoringPaths();
  redirect(`/monitoring?versionId=${versionId}&evaluated=${result.evaluated}&changed=${result.changed}`);
}

export async function refreshAllStrategyHealthAction() {
  const user = await requireUser();
  const result = await evaluateAndPersistStrategyHealth({
    userId: user.id,
    source: "MANUAL",
  });
  revalidateMonitoringPaths();
  redirect(`/monitoring?evaluated=${result.evaluated}&changed=${result.changed}`);
}

export async function updateStrategyMonitoringSettingsAction(formData: FormData) {
  const user = await requireUser();
  const versionId = text(formData, "versionId");
  if (!versionId) redirect("/monitoring?error=missing");

  const settings = {
    minForwardSample: Math.floor(numberField(formData, "minForwardSample", { min: 5, max: 1000 })),
    maxDrawdownPercent: numberField(formData, "maxDrawdownPercent", { min: 0.1, max: 100 }),
    maxLossPercent: numberField(formData, "maxLossPercent", { min: 0.1, max: 100 }),
  };

  const version = await prisma.analysisStrategyVersion.findFirst({
    where: { id: versionId, userId: user.id },
  });
  if (!version) redirect("/monitoring?error=missing");

  await prisma.$transaction(async (tx) => {
    await tx.analysisStrategyVersion.update({
      where: { id: versionId },
      data: settings,
    });
    await tx.auditLog.create({
      data: {
        entityType: AuditEntityType.ANALYSIS_STRATEGY,
        entityId: version.strategyId,
        action: "UPDATE_STRATEGY_MONITORING_SETTINGS",
        userId: user.id,
        changes: {
          create: [
            {
              fieldName: "minForwardSample",
              oldValue: valueToString(version.minForwardSample),
              newValue: valueToString(settings.minForwardSample),
            },
            {
              fieldName: "maxDrawdownPercent",
              oldValue: valueToString(version.maxDrawdownPercent),
              newValue: valueToString(settings.maxDrawdownPercent),
            },
            {
              fieldName: "maxLossPercent",
              oldValue: valueToString(version.maxLossPercent),
              newValue: valueToString(settings.maxLossPercent),
            },
          ],
        },
      },
    });
  });

  await evaluateAndPersistStrategyHealth({
    userId: user.id,
    versionId,
    source: "MANUAL",
  });
  revalidateMonitoringPaths();
  redirect(`/monitoring?versionId=${versionId}&settings=1`);
}
