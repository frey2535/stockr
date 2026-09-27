import { NextResponse } from "next/server";
import { identifyRemoteProduct, searchRemoteProduct } from "@/lib/barcode-lookup";
import { resolvePhotoIdentity } from "@/lib/identify-photo";
import { materialMatchesCode } from "@/lib/inventory";
import { requireAccount } from "@/lib/require-account";
import { lookupMaterials } from "@/lib/workspace-data";
import type { IdentifiedProduct } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

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

function asProduct(parsed: Record<string, unknown>, source: string): IdentifiedProduct | null {
  const name = firstString(parsed.name, parsed.title, parsed.search_query);
  if (!name) return null;
  const queries = Array.isArray(parsed.search_queries)
    ? parsed.search_queries.map((row) => firstString(row)).filter(Boolean)
    : [];
  const extra = firstString(parsed.search_query);
  if (extra) queries.unshift(extra);
  const barcode = barcodeFromText(parsed.barcode, parsed.upc, parsed.ean, parsed.gtin);
  return {
    name,
    brand: firstString(parsed.brand) || undefined,
    manufacturer: firstString(parsed.manufacturer, parsed.brand) || undefined,
    category: firstString(parsed.category) || undefined,
    description: firstString(parsed.description) || undefined,
    barcode,
    upc: firstString(parsed.upc, barcode) || undefined,
    mpn: firstString(parsed.mpn, parsed.sku, parsed.catalog_number, parsed.part_number) || undefined,
    source,
    search_queries: queries.slice(0, 6),
  };
}

const LENS_PROMPT =
  "You are a visual product identifier for contractor materials, like Google Lens. Look at the item, not only a barcode. Name the exact product (brand, trade name, size/amp/color). Read any printed catalog/part/SKU/MPN. Read barcode digits if they are visible. If this is a well-known catalog part, include the standard manufacturer number (example: Square D QO120). Return JSON with name, brand, manufacturer, barcode, upc, mpn, category, description, search_queries (3 short distributor searches that would return this item's UPC and manufacturer number). Use empty strings when unknown.";

async function identifyWithOpenAI(image: string): Promise<IdentifiedProduct | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: LENS_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Identify this item and the search queries that will find its barcode and manufacturer number." },
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
  return asProduct(JSON.parse(raw) as Record<string, unknown>, "photo-vision");
}

async function identifyWithGemini(image: string): Promise<IdentifiedProduct | null> {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) return null;
  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
        contents: [
          {
            parts: [
              { text: `${LENS_PROMPT}\nIdentify this item and the search queries that will find its barcode and manufacturer number.` },
              { inline_data: { mime_type: match[1], data: match[2] } },
            ],
          },
        ],
      }),
    },
  );
  const data = (await response.json().catch(() => null)) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  } | null;
  const raw = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  if (!raw) return null;
  return asProduct(JSON.parse(raw) as Record<string, unknown>, "photo-vision");
}

async function identifyFromVision(image: string): Promise<IdentifiedProduct | null> {
  if (!image.startsWith("data:image")) return null;
  try {
    return (await identifyWithOpenAI(image)) || (await identifyWithGemini(image));
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
  const result = await resolvePhotoIdentity(barcode, vision, identifyRemoteProduct, searchRemoteProduct);

  const catalogQuery = result.identified?.barcode || result.draft.barcode || barcode;
  const catalog = catalogQuery
    ? await lookupMaterials(account.company.id, { barcode: catalogQuery, q: catalogQuery, limit: 8 })
    : { rows: [], onHandByLocation: {} };
  const rows = (catalog.rows || []).filter((row) => catalogQuery && materialMatchesCode(row, catalogQuery));

  return NextResponse.json({
    identified: result.identified,
    draft: result.draft,
    missing: result.missing,
    rows,
    onHandByLocation: catalog.onHandByLocation || {},
  });
}
