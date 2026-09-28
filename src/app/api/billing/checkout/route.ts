import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth";
import { canChangeBilling } from "@/lib/command-access";
import { getAccount, setCompanyPlan } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import { allowMockBilling } from "@/lib/production";
import { requestOrigin } from "@/lib/request-origin";
import { checkoutIntegrationId, getStripe, stripeConfigured, stripePriceId } from "@/lib/stripe";
import type { PlanId } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canChangeBilling(account.role)) {
    return NextResponse.json({ error: "Only owners and admins can change the plan." }, { status: 403 });
  }
  if (request.headers.get("x-stockr-client") === "play") {
    return NextResponse.json(
      { error: "Use Google Play Billing in the Play Store app." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as { plan?: PlanId } | null;
  const plan = PLANS.find((row) => row.id === body?.plan);
  if (!plan) return NextResponse.json({ error: "Unknown plan." }, { status: 400 });

  if (plan.id === "starter") {
    await setCompanyPlan(account.company.id, "starter");
    return NextResponse.json({
      ok: true,
      account: await getAccount(account.user.id, account.company.id),
    });
  }

  const stripe = getStripe();
  const priceId = stripePriceId(plan.id);
  if (stripe && priceId && stripeConfigured()) {
    const origin = requestOrigin(request).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: account.user.email,
      client_reference_id: account.company.id,
      metadata: {
        companyId: account.company.id,
        userId: account.user.id,
        plan: plan.id,
      },
      subscription_data: {
        metadata: {
          companyId: account.company.id,
          plan: plan.id,
        },
      },
      success_url: `${origin}/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing`,
      integration_identifier: checkoutIntegrationId(),
    });
    return NextResponse.json({ ok: true, url: session.url, provider: "stripe" });
  }

  if (!allowMockBilling()) {
    return NextResponse.json(
      { error: "Card checkout is not configured. Use the website with Stripe, or the Android app with Google Play." },
      { status: 503 },
    );
  }

  await setCompanyPlan(account.company.id, plan.id);
  return NextResponse.json({
    ok: true,
    mock: true,
    account: await getAccount(account.user.id, account.company.id),
  });
}
