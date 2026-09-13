import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ account });
}
