import { NextResponse } from "next/server";
import { currentBuildVersion } from "@/lib/build-version";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(currentBuildVersion(), {
    headers: {
      "Cache-Control": "no-store, max-age=0, must-revalidate",
    },
  });
}
