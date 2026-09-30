import { NextResponse } from "next/server";
import { listCompanies } from "@/lib/db";
import { requirePlatformOwner } from "@/lib/require-account";
import { companyListQuery } from "@/lib/tenants";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { account, response } = await requirePlatformOwner();
  if (!account || response) return response;

  const url = new URL(request.url);
  const query = companyListQuery({
    q: url.searchParams.get("q") || "",
    limit: Number(url.searchParams.get("limit") || 25),
    offset: Number(url.searchParams.get("offset") || 0),
  });
  return NextResponse.json(await listCompanies(query));
}
