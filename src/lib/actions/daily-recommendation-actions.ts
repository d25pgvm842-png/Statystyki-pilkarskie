"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWriteUser } from "@/lib/auth";
import { syncActiveForwardSignals } from "@/lib/data/strategy-forward";
import { evaluateAndPersistStrategyHealth } from "@/lib/data/strategy-monitoring";

function hoursFromForm(formData: FormData) {
  const value = Number(String(formData.get("hours") ?? "48"));
  return [24, 48, 72, 168].includes(value) ? value : 48;
}

export async function refreshDailyRecommendationsAction(formData: FormData) {
  const user = await requireWriteUser();
  const hours = hoursFromForm(formData);
  const captured = await syncActiveForwardSignals(user.id);
  const health = await evaluateAndPersistStrategyHealth({
    userId: user.id,
    source: "SYNC",
  });

  revalidatePath("/recommendations");
  revalidatePath("/portfolio");
  revalidatePath("/monitoring");
  revalidatePath("/journal");
  revalidatePath("/scanner");

  redirect(
    `/recommendations?hours=${hours}&refreshed=1&captured=${captured}&evaluated=${health.evaluated}&changed=${health.changed}`,
  );
}
