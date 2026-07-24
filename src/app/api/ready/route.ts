import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createReadinessResult } from "@/lib/release-readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

async function resolveReadiness() {
  return createReadinessResult(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });
}

export async function GET() {
  const result = await resolveReadiness();

  return NextResponse.json(result.payload, {
    status: result.statusCode,
    headers: NO_STORE_HEADERS,
  });
}

export async function HEAD() {
  const result = await resolveReadiness();

  return new NextResponse(null, {
    status: result.statusCode,
    headers: {
      ...NO_STORE_HEADERS,
      "X-Release-Status": result.payload.status,
    },
  });
}
