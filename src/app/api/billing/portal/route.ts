import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth";
import { requestOrigin } from "@/lib/request-origin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });

  const customers = await stripe.customers.list({ email: account.user.email, limit: 1 });
  const customer = customers.data[0];
  if (!customer) {
    return NextResponse.json({ error: "No Stripe customer exists for this login yet." }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: `${requestOrigin(request).origin}/billing`,
  });
  return NextResponse.json({ url: session.url });
}
