import { prepareCurrentPublicBatch } from "@/lib/actions/public-data-actions";
import { prisma } from "@/lib/db";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const headerSecret = request.headers.get("x-cron-secret") ?? "";
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function run(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Brak poprawnego CRON_SECRET." }, { status: 401 });
  }

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!admin) {
    return Response.json({ error: "Brak aktywnego administratora." }, { status: 503 });
  }

  const seasons = await prisma.season.findMany({
    where: { active: true, league: { active: true } },
    include: { league: true },
    orderBy: { league: { name: "asc" } },
  });
  if (!seasons.length) {
    return Response.json({ ok: true, skipped: true, reason: "Brak aktywnych sezonów." });
  }

  const freshness = await Promise.all(
    seasons.map(async (season) => {
      const latest = await prisma.match.findFirst({
        where: { seasonId: season.id, sourceUpdatedAt: { not: null } },
        orderBy: { sourceUpdatedAt: "desc" },
        select: { sourceUpdatedAt: true },
      });
      return { season, lastUpdatedAt: latest?.sourceUpdatedAt?.getTime() ?? 0 };
    }),
  );
  freshness.sort((left, right) => left.lastUpdatedAt - right.lastUpdatedAt);
  const selected = freshness[0]!.season;

  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 3);
  const to = new Date(today);
  to.setUTCDate(to.getUTCDate() + 14);

  try {
    const result = await prepareCurrentPublicBatch({
      userId: admin.id,
      seasonId: selected.id,
      fromValue: dateInput(from),
      toValue: dateInput(to),
      batchNamePrefix: "CRON aktualizacja",
    });
    return Response.json({
      ok: true,
      season: `${selected.league.name} · ${selected.name}`,
      ...result,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        season: `${selected.league.name} · ${selected.name}`,
        error: error instanceof Error ? error.message : "Nieznany błąd aktualizacji.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
