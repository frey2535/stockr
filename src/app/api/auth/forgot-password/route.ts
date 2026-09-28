import { NextResponse } from "next/server";
import { createPasswordReset } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { SITE_URL, SUPPORT_EMAIL } from "@/lib/site";

export const runtime = "nodejs";

async function sendResetEmail(email: string, token: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  const link = `${SITE_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM?.trim() || SUPPORT_EMAIL,
      to: email,
      subject: "Reset your Stockr password",
      text: `Reset your Stockr password: ${link}\nThis link expires in one hour. If you did not ask for this, ignore the email.`,
    }),
  });
  return response.ok;
}

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "forgot"), 5, 15 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many reset requests. Try again later." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const reset = await createPasswordReset(email);
  if (reset?.token) await sendResetEmail(reset.email, reset.token);
  return NextResponse.json({
    ok: true,
    message: `If that email has a Stockr account, we sent a reset link. Contact ${SUPPORT_EMAIL} if you do not receive it.`,
  });
}
