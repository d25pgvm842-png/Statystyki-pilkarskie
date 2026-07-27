import { requireUser } from "@/lib/auth";
import {
  HistoricalBackfillBusyError,
  processHistoricalBackfillStep,
} from "@/lib/history/backfill-service";
import { canAdminister } from "@/lib/permissions";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!canAdminister(user.role)) {
    return Response.json(
      { error: "Brak uprawnień administratora." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const jobId = text(body.jobId);
    if (!jobId) {
      return Response.json(
        { error: "Brakuje identyfikatora zadania." },
        { status: 400 },
      );
    }

    const result = await processHistoricalBackfillStep({
      jobId,
      userId: user.id,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error
          ? error.message
          : "Nie udało się wykonać kroku backfillu.",
      },
      {
        status: error instanceof HistoricalBackfillBusyError ? 409 : 400,
      },
    );
  }
}
