import { NextResponse } from "next/server";
import { getCurrentAccount } from "./auth";

export async function requireAccount() {
  const account = await getCurrentAccount();
  if (!account) {
    return {
      account: null as null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { account, response: null };
}

export async function requirePlatformOwner() {
  const result = await requireAccount();
  if (result.response) return result;
  if (!result.account.platformOwner) {
    return {
      account: null as null,
      response: NextResponse.json({ error: "Platform owner required." }, { status: 403 }),
    };
  }
  return result;
}
