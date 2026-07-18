import packageJson from "../../../../package.json";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return json({
      status: "ok",
      database: "ok",
      version: packageJson.version,
      responseTimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return json(
      {
        status: "degraded",
        database: "error",
        version: packageJson.version,
        responseTimeMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      503,
    );
  }
}
