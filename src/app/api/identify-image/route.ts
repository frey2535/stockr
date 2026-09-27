import { NextResponse } from "next/server";
import { identifyRemoteProduct, searchRemoteProduct } from "@/lib/barcode-lookup";
import { parseVisionObjects, resolvePhotoIdentities } from "@/lib/identify-photo";
import { materialMatchesCode } from "@/lib/inventory";
import { requireAccount } from "@/lib/require-account";
import { lookupMaterials } from "@/lib/workspace-data";
import type { IdentifiedProduct } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const LENS_PROMPT =
  "You are an upgraded object detector and visual product identifier for contractor materials, like Google Lens. Detect EVERY distinct product in the photo — tools, fittings, boxes, reels, breakers, labels, packaged goods. Do not stop at the largest object. Same SKU seen more than once is one object with quantity. For each object: name the exact product, read printed catalog/part/SKU/MPN, read barcode digits if visible, and give 2 short search queries that would find its UPC and manufacturer number. Return JSON { objects: [{ name, brand, manufacturer, barcode, upc, mpn, category, description, quantity, search_queries, box: { x, y, w, h } }] }. box values are 0-1 fractions of the image. Use empty strings when unknown.";

function parseModelJson(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function detectObjectsWithOpenAI(image: string): Promise<IdentifiedProduct[]> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return [];
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
            { type: "text", text: "Detect and identify every distinct item in this photo." },
            { type: "image_url", image_url: { url: image, detail: "high" } },
          ],
        },
      ],
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null;
  return parseVisionObjects(parseModelJson(data?.choices?.[0]?.message?.content || ""));
}

async function detectObjectsWithGemini(image: string): Promise<IdentifiedProduct[]> {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) return [];
  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return [];
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
              { text: `${LENS_PROMPT}\nDetect and identify every distinct item in this photo.` },
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
  return parseVisionObjects(parseModelJson(raw));
}

async function detectObjectsFromVision(image: string): Promise<IdentifiedProduct[]> {
  if (!image.startsWith("data:image")) return [];
  try {
    const openai = await detectObjectsWithOpenAI(image);
    if (openai.length) return openai;
    return await detectObjectsWithGemini(image);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const { account, response } = await requireAccount();
  if (!account) return response;
  const body = (await request.json().catch(() => null)) as { image?: string; barcode?: string; barcodes?: string[] } | null;
  const barcodes = Array.from(
    new Set([body?.barcode, ...(Array.isArray(body?.barcodes) ? body.barcodes : [])].map((value) => String(value || "").trim()).filter(Boolean)),
  );
  const image = String(body?.image || "");
  const objects = image.startsWith("data:image") ? await detectObjectsFromVision(image) : [];
  const items = await resolvePhotoIdentities(objects, barcodes, identifyRemoteProduct, searchRemoteProduct);

  const first = items[0];
  const catalogQuery = first?.identified?.barcode || first?.draft.barcode || barcodes[0] || "";
  const catalog = catalogQuery
    ? await lookupMaterials(account.company.id, { barcode: catalogQuery, q: catalogQuery, limit: 8 })
    : { rows: [], onHandByLocation: {} };
  const rows = (catalog.rows || []).filter((row) => catalogQuery && materialMatchesCode(row, catalogQuery));

  return NextResponse.json({
    items,
    identified: first?.identified || null,
    draft: first?.draft || { name: "", barcode: "", mpn: "", source: "photo" },
    missing: first?.missing || ["name", "barcode", "mpn"],
    count: items.length,
    rows,
    onHandByLocation: catalog.onHandByLocation || {},
  });
}
