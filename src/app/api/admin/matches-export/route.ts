import { getCurrentUser } from "@/lib/auth";
import { canAdminister } from "@/lib/permissions";
import { buildMatchesCsv, exportFileDate } from "@/lib/backup/csv";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.active) return Response.json({ error: "Brak autoryzacji." }, { status: 401 });
  if (!canAdminister(user.role)) return Response.json({ error: "Brak uprawnień administratora." }, { status: 403 });

  const matches = await prisma.match.findMany({
    include: {
      season: { include: { league: true } },
      homeTeam: true,
      awayTeam: true,
      referee: true,
      dataSource: true,
      stats: true,
    },
    orderBy: [{ kickoffAt: "desc" }, { createdAt: "desc" }],
  });

  return new Response(buildMatchesCsv(matches), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="staty-pilkarskie-mecze-${exportFileDate()}.csv"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
