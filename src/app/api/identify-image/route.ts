import { NextResponse } from "next/server";
import { identifyRemoteProduct, searchRemoteProduct } from "@/lib/barcode-lookup";
import { resolvePhotoIdentity } from "@/lib/identify-photo";
import { materialMatchesCode } from "@/lib/inventory";
import { requireAccount } from "@/lib/require-account";
import { lookupMaterials } from "@/lib/workspace-data";
import type { IdentifiedProduct } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function barcodeFromText(...values: unknown[]) {
  for (const value of values) {
    const text = firstString(value);
    const compact = text.replace(/[\s-]/g, "");
    if (/^[A-Za-z0-9.\-\/_]{6,32}$/.test(compact) && /\d/.test(compact)) return compact;
    const digits = text.replace(/\D/g, "");
    if (digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14) return digits;
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
              "Identify the product in the photo for a contractor inventory app. Read any barcode, UPC, EAN, MPN, SKU, or printed name. Return JSON with name, brand, manufacturer, barcode, upc, mpn, category, description, search_query. Use empty strings when unknown. name and search_query must be specific enough to find the item online.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "What exact product is this? Prefer printed barcode digits, then the trade name and manufacturer.",
              },
              { type: "image_url", image_url: { url: image, detail: "high" } },
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
    const name = firstString(parsed.name, parsed.title, parsed.search_query);
    if (!name) return null;
    const barcode = barcodeFromText(parsed.barcode, parsed.upc, parsed.ean, parsed.gtin, parsed.mpn);
    return {
      name,
      brand: firstString(parsed.brand) || undefined,
      manufacturer: firstString(parsed.manufacturer, parsed.brand) || undefined,
      category: firstString(parsed.category) || undefined,
      description: firstString(parsed.description, parsed.search_query) || undefined,
      barcode,
      upc: firstString(parsed.upc, barcode) || undefined,
      mpn: firstString(parsed.mpn, parsed.sku) || undefined,
      source: "photo-vision",
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
  const image = String(body?.image || "");
  const vision = image.startsWith("data:image") ? await identifyFromVision(image) : null;
  const identified = await resolvePhotoIdentity(barcode, vision, identifyRemoteProduct, searchRemoteProduct);

  const catalogQuery = identified.barcode || barcode;
  const catalog = catalogQuery
    ? await lookupMaterials(account.company.id, { barcode: catalogQuery, q: catalogQuery, limit: 8 })
    : { rows: [], onHandByLocation: {} };
  const rows = (catalog.rows || []).filter((row) => catalogQuery && materialMatchesCode(row, catalogQuery));

  return NextResponse.json({
    identified,
    rows,
    onHandByLocation: catalog.onHandByLocation || {},
  });
}
