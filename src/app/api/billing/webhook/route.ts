import { NextResponse } from "next/server";
import { setCompanyPlan } from "@/lib/db";
import { getStripe, planFromStripePrice } from "@/lib/stripe";
import type { PlanId } from "@/lib/types";

export const runtime = "nodejs";

function planFromMetadata(value: unknown): PlanId | null {
  return value === "pro" || value === "fleet" || value === "starter" ? value : null;
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const companyId = session.metadata?.companyId || session.client_reference_id;
    const plan =
      planFromMetadata(session.metadata?.plan) ||
      planFromStripePrice(session.line_items?.data?.[0]?.price?.id);
    if (companyId && plan) await setCompanyPlan(companyId, plan);
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
    const subscription = event.data.object;
    const companyId = subscription.metadata?.companyId;
    const priceId = subscription.items.data[0]?.price?.id;
    const plan = planFromMetadata(subscription.metadata?.plan) || planFromStripePrice(priceId);
    if (companyId && plan && subscription.status === "active") {
      await setCompanyPlan(companyId, plan);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const companyId = subscription.metadata?.companyId;
    if (companyId) await setCompanyPlan(companyId, "starter");
  }

  return NextResponse.json({ received: true });
}
