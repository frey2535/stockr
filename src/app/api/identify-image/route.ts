import { NextResponse } from "next/server";
import { identifyRemoteProduct } from "@/lib/barcode-lookup";
import { requireAccount } from "@/lib/require-account";
import { lookupMaterials } from "@/lib/workspace-data";
import type { IdentifiedProduct } from "@/lib/types";

export const runtime = "nodejs";

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function identifyFromVision(image: string): Promise<IdentifiedProduct | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || !image.startsWith("data:image")) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Identify the electrical or construction product in the photo. Return JSON with name, brand, barcode, upc, mpn, category, description. Use empty strings when unknown. Prefer the printed barcode digits if visible.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "What exact product is this?" },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });
    const data = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
    } | null;
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const name = firstString(parsed.name, parsed.title);
    if (!name) return null;
    const barcode = firstString(parsed.barcode, parsed.upc, parsed.ean);
    return {
      name,
      brand: firstString(parsed.brand) || undefined,
      manufacturer: firstString(parsed.brand, parsed.manufacturer) || undefined,
      category: firstString(parsed.category) || undefined,
      description: firstString(parsed.description) || undefined,
      barcode,
      upc: firstString(parsed.upc, barcode) || undefined,
      mpn: firstString(parsed.mpn) || undefined,
      source: "photo",
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const { account, response } = await requireAccount();
  if (!account) return response;
  const body = (await request.json().catch(() => null)) as { image?: string; barcode?: string } | null;
  const barcode = String(body?.barcode || "").trim();
  let identified = barcode ? await identifyRemoteProduct(barcode) : null;
  if (!identified && body?.image) identified = await identifyFromVision(body.image);
  if (!identified) {
    return NextResponse.json({
      identified: null,
      error: "Could not read a barcode or identify the item from that photo. Try a closer shot of the label.",
    });
  }

  const catalog = await lookupMaterials(account.company.id, {
    barcode: identified.barcode || barcode,
    q: identified.name,
    limit: 8,
  });
  return NextResponse.json({
    identified,
    rows: catalog.rows,
    onHandByLocation: catalog.onHandByLocation || {},
  });
}
