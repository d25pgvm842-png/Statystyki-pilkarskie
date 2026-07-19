import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { exportFileDate } from "@/lib/backup/csv";
import { listExternalMappings } from "@/lib/external-mappings";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.active) return Response.json({ error: "Brak autoryzacji." }, { status: 401 });
  if (user.role !== "ADMIN") return Response.json({ error: "Brak uprawnień administratora." }, { status: 403 });

  const [
    users,
    leagues,
    seasons,
    teams,
    seasonTeams,
    referees,
    refereeSeasons,
    dataSources,
    matches,
    importBatches,
    importRows,
    auditLogs,
    customLines,
    externalMappings,
  ] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.league.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.season.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.team.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.seasonTeam.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.referee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.refereeSeason.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.dataSource.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.match.findMany({
      include: { stats: true, overrides: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.importBatch.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.importRow.findMany({ orderBy: [{ importId: "asc" }, { rowNumber: "asc" }] }),
    prisma.auditLog.findMany({ include: { changes: true }, orderBy: { createdAt: "asc" } }),
    prisma.customLine.findMany({ orderBy: { createdAt: "asc" } }),
    listExternalMappings({ providerCode: "api-football" }),
  ]);

  const payload = {
    metadata: {
      format: "staty-pilkarskie-backup",
      formatVersion: 1,
      appVersion: process.env.npm_package_version ?? "unknown",
      exportedAt: new Date().toISOString(),
      exportedBy: { id: user.id, email: user.email, name: user.name },
      security: "Hasła użytkowników nie są zawarte w kopii.",
    },
    counts: {
      users: users.length,
      leagues: leagues.length,
      seasons: seasons.length,
      teams: teams.length,
      referees: referees.length,
      matches: matches.length,
      imports: importBatches.length,
      auditLogs: auditLogs.length,
      externalMappings: externalMappings.length,
    },
    data: {
      users,
      leagues,
      seasons,
      teams,
      seasonTeams,
      referees,
      refereeSeasons,
      dataSources,
      matches,
      importBatches,
      importRows,
      auditLogs,
      customLines,
      externalMappings,
    },
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="staty-pilkarskie-backup-${exportFileDate()}.json"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
