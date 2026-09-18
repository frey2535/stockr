import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth";
import { getAccount, setCompanyPlan } from "@/lib/db";
import { getStripe, planFromStripePrice } from "@/lib/stripe";
import type { PlanId } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { sessionId?: string } | null;
  if (!body?.sessionId) return NextResponse.json({ error: "Missing session." }, { status: 400 });

  const session = await stripe.checkout.sessions.retrieve(body.sessionId, {
    expand: ["line_items.data.price"],
  });
  if (session.metadata?.companyId && session.metadata.companyId !== account.company.id) {
    return NextResponse.json({ error: "This checkout belongs to another company." }, { status: 403 });
  }
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return NextResponse.json({ error: "Checkout is not complete." }, { status: 400 });
  }

  const plan =
    (session.metadata?.plan as PlanId | undefined) ||
    planFromStripePrice(
      typeof session.line_items?.data?.[0]?.price === "object"
        ? session.line_items.data[0].price?.id
        : undefined,
    );
  if (!plan || plan === "starter") {
    return NextResponse.json({ error: "Could not determine the paid plan." }, { status: 400 });
  }

  await setCompanyPlan(account.company.id, plan);
  return NextResponse.json({
    ok: true,
    account: await getAccount(account.user.id, account.company.id),
  });
}
