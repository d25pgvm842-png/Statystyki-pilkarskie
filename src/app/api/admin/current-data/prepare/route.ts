import { CurrentDataSyncTrigger } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import {
  CurrentDataSyncBusyError,
  prepareTrackedCurrentPublicBatch,
} from "@/lib/current-data/sync-coordinator";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return Response.json({ error: "Brak uprawnień administratora." }, { status: 403 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const result = await prepareTrackedCurrentPublicBatch({
      userId: user.id,
      seasonId: text(body.seasonId),
      fromValue: text(body.from),
      toValue: text(body.to),
      trigger: CurrentDataSyncTrigger.MANUAL,
      batchNamePrefix: "Aktualizacja bieżąca",
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Nie udało się przygotować aktualizacji." },
      { status: error instanceof CurrentDataSyncBusyError ? 409 : 400 },
    );
  }
}
