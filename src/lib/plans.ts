import type { PlanId } from "./types";

export type Plan = {
  id: PlanId;
  name: string;
  monthlyPrice: number;
  blurb: string;
  locations: number | null;
  materials: number | null;
  seats: number | null;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 0,
    blurb: "One shop getting off clipboards",
    locations: 2,
    materials: 50,
    seats: 2,
    features: [
      "2 warehouses or trucks",
      "50 catalog items",
      "2 team seats",
      "Barcode scan and transfers",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 49,
    blurb: "Growing service fleets",
    locations: 15,
    materials: 2000,
    seats: 15,
    features: [
      "15 locations",
      "2,000 catalog items",
      "15 team seats",
      "Purchase orders and reports",
      "Invite contractors",
    ],
  },
  {
    id: "fleet",
    name: "Fleet",
    monthlyPrice: 149,
    blurb: "Multi-crew contractors",
    locations: null,
    materials: null,
    seats: null,
    features: [
      "Unlimited locations and materials",
      "Unlimited seats",
      "Priority onboarding",
      "Sample-data reset for training",
    ],
  },
];

export function getPlan(id: PlanId) {
  return PLANS.find((plan) => plan.id === id) || PLANS[0];
}

export function planLimitError(
  planId: PlanId,
  counts: { locations?: number; materials?: number },
  action: "location" | "material" | "seat",
  extraSeats = 0,
) {
  const plan = getPlan(planId);
  if (action === "location" && plan.locations != null && (counts.locations ?? 0) >= plan.locations) {
    return `${plan.name} includes ${plan.locations} locations. Upgrade to add more.`;
  }
  if (action === "material" && plan.materials != null && (counts.materials ?? 0) >= plan.materials) {
    return `${plan.name} includes ${plan.materials} materials. Upgrade to add more.`;
  }
  if (action === "seat" && plan.seats != null && extraSeats >= plan.seats) {
    return `${plan.name} includes ${plan.seats} seats. Upgrade to add more people.`;
  }
  return null;
}
