import { NextResponse } from "next/server";
import { createHealthPayload } from "@/lib/release-health";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

export function GET() {
  return NextResponse.json(createHealthPayload(), {
    status: 200,
    headers: NO_STORE_HEADERS,
  });
}

export function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: NO_STORE_HEADERS,
  });
}
