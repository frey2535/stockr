import { createSign } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth";
import { getAccount, setCompanyPlan } from "@/lib/db";
import { PLAY_PACKAGE, planFromPlayProduct } from "@/lib/play-products";

export const runtime = "nodejs";

function googleServiceJwt(credentials: { client_email: string; private_key: string; token_uri?: string }) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: credentials.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: credentials.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(credentials.private_key.replace(/\\n/g, "\n"), "base64url")}`;
}

async function googleAccessToken() {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  const credentials = JSON.parse(raw) as {
    client_email: string;
    private_key: string;
    token_uri?: string;
  };
  const response = await fetch(credentials.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: googleServiceJwt(credentials),
    }),
  });
  const data = (await response.json().catch(() => null)) as { access_token?: string } | null;
  return data?.access_token || null;
}

async function verifyPlayPurchase(productId: string, token: string, packageName: string) {
  const accessToken = await googleAccessToken();
  if (!accessToken) {
    if (process.env.GOOGLE_PLAY_ALLOW_UNVERIFIED === "1") return { ok: true, unverified: true };
    return { ok: false, error: "Google Play billing is not configured on the server." };
  }
  const encoded = encodeURIComponent(token);
  const urls = [
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${encoded}`,
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${encoded}`,
  ];
  for (const url of urls) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.ok) return { ok: true, unverified: false };
  }
  return { ok: false, error: "Google Play did not recognize that purchase." };
}

export async function POST(request: Request) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (account.role === "member") {
    return NextResponse.json({ error: "Only owners and admins can change the plan." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    productId?: string;
    purchaseToken?: string;
    packageName?: string;
  } | null;
  const productId = body?.productId?.trim() || "";
  const purchaseToken = body?.purchaseToken?.trim() || "";
  const plan = planFromPlayProduct(productId);
  if (!plan || plan === "starter") {
    return NextResponse.json({ error: "Unknown Play product." }, { status: 400 });
  }
  if (!purchaseToken) {
    return NextResponse.json({ error: "A Play purchase token is required." }, { status: 400 });
  }

  const verified = await verifyPlayPurchase(
    productId,
    purchaseToken,
    body?.packageName || PLAY_PACKAGE,
  );
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  await setCompanyPlan(account.company.id, plan);
  return NextResponse.json({
    ok: true,
    provider: "play",
    unverified: verified.unverified || false,
    account: await getAccount(account.user.id, account.company.id),
  });
}
