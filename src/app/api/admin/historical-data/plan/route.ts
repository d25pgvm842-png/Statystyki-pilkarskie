import { requireUser } from "@/lib/auth";
import { planHistoricalBackfill } from "@/lib/history/backfill-service";
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
    const providerSeason = Number(body.providerSeason);
    const result = await planHistoricalBackfill({
      userId: user.id,
      leagueId: text(body.leagueId),
      providerSeason,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error
          ? error.message
          : "Nie udało się zaplanować historycznego importu.",
      },
      { status: 400 },
    );
  }
}
