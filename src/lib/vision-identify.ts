import type { IdentifiedProduct } from "./types";
import { parseVisionObjects } from "./identify-photo";

export const LENS_PROMPT =
  "You are a visual product identifier for contractor materials, like Google Lens. Detect EVERY distinct product in the photo — tools, fittings, boxes, reels, breakers, labels, packaged goods. Do not stop at the largest object. Same SKU more than once is one object with quantity. For each object: name the exact commercial product, read printed barcode/UPC/EAN digits, read printed manufacturer/catalog/part/SKU/MPN, and if the exact SKU is a known catalog item fill the canonical UPC and manufacturer number from product knowledge. Give 2 short search queries that would find this SKU. Do not invent random digits. Use an empty string only when that field cannot be determined for the exact SKU. Return JSON { objects: [{ name, brand, manufacturer, barcode, upc, mpn, category, description, quantity, search_queries, box: { x, y, w, h } }] }. box values are 0-1 fractions of the image.";

const IDENTITY_PROMPT =
  "You complete product identity for field inventory. Given a product already seen, return the canonical trade name, UPC/EAN barcode, and manufacturer catalog number (MPN). Only fill barcode and MPN when you know the exact SKU. Do not invent digits. Return JSON { name, brand, manufacturer, barcode, upc, mpn, search_queries }.";

const VISION_SCHEMA = {
  type: "object",
  properties: {
    objects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          brand: { type: "string" },
          manufacturer: { type: "string" },
          barcode: { type: "string" },
          upc: { type: "string" },
          mpn: { type: "string" },
          category: { type: "string" },
          description: { type: "string" },
          quantity: { type: "number" },
          search_queries: { type: "array", items: { type: "string" } },
          box: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              w: { type: "number" },
              h: { type: "number" },
            },
          },
        },
      },
    },
  },
};

type WorkersAi = { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };

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

function asText(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const result = record.result;
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const inner = result as Record<string, unknown>;
    if (typeof inner.response === "string") return inner.response;
    if (typeof inner.result === "string") return inner.result;
    if (typeof inner.text === "string") return inner.text;
  }
  if (typeof record.response === "string") return record.response;
  if (typeof record.text === "string") return record.text;
  const choices = record.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const message = (choices[0] as { message?: { content?: string } }).message;
    if (message?.content) return message.content;
  }
  return "";
}

async function workersAiBinding(): Promise<WorkersAi | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const ai = (env as { AI?: WorkersAi }).AI;
    return ai || null;
  } catch {
    return null;
  }
}

function workersAiRest(): { account: string; token: string } | null {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token =
    process.env.CLOUDFLARE_AI_TOKEN?.trim() ||
    process.env.CLOUDFLARE_API_TOKEN?.trim() ||
    process.env.CLOUDFLARE_AUTH_TOKEN?.trim();
  if (!account || !token) return null;
  return { account, token };
}

export function hasVisionProvider() {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      process.env.CLOUDFLARE_ACCOUNT_ID?.trim(),
  );
}

export async function canUseVision() {
  if (hasVisionProvider()) return true;
  return Boolean(await workersAiBinding());
}

async function runWorkersAi(model: string, input: Record<string, unknown>) {
  const binding = await workersAiBinding();
  if (binding) return binding.run(model, input);
  const rest = workersAiRest();
  if (!rest) return null;
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(rest.account)}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${rest.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
  const data = (await response.json().catch(() => null)) as { result?: unknown; success?: boolean } | null;
  if (!response.ok) return null;
  return data?.result ?? data;
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

async function detectObjectsWithWorkersAi(image: string): Promise<IdentifiedProduct[]> {
  if (!image.startsWith("data:image")) return [];
  if (!(await workersAiBinding()) && !workersAiRest()) return [];
  const models = ["@cf/meta/llama-4-scout-17b-16e-instruct", "@cf/meta/llama-3.2-11b-vision-instruct"];
  for (const model of models) {
    const payload = await runWorkersAi(model, {
      temperature: 0,
      max_tokens: 2048,
      guided_json: VISION_SCHEMA,
      messages: [
        { role: "system", content: LENS_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Detect and identify every distinct item in this photo. JSON only." },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    });
    const objects = parseVisionObjects(parseModelJson(asText(payload)));
    if (objects.length) return objects;
  }
  return [];
}

export async function detectObjectsFromVision(image: string): Promise<IdentifiedProduct[]> {
  if (!image.startsWith("data:image")) return [];
  try {
    const openai = await detectObjectsWithOpenAI(image);
    if (openai.length) return openai;
    const gemini = await detectObjectsWithGemini(image);
    if (gemini.length) return gemini;
    return await detectObjectsWithWorkersAi(image);
  } catch {
    return [];
  }
}

export async function completeProductIdentity(product: Partial<IdentifiedProduct>): Promise<IdentifiedProduct | null> {
  const hint = [product.brand, product.manufacturer, product.name, product.mpn, product.barcode]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (hint.length < 3) return null;

  const ask = async (raw: string) => {
    const parsed = parseVisionObjects(parseModelJson(raw));
    if (parsed[0]) return parsed[0];
    const record = parseModelJson(raw);
    return parseVisionObjects(record && typeof record === "object" ? { objects: [record] } : null)[0] || null;
  };

  try {
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiKey) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: IDENTITY_PROMPT },
            { role: "user", content: hint },
          ],
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: string } }>;
      } | null;
      const found = await ask(data?.choices?.[0]?.message?.content || "");
      if (found) return { ...found, source: "photo-knowledge" };
    }

    const payload = await runWorkersAi("@cf/meta/llama-4-scout-17b-16e-instruct", {
      temperature: 0,
      max_tokens: 512,
      messages: [
        { role: "system", content: IDENTITY_PROMPT },
        { role: "user", content: hint },
      ],
    });
    const found = await ask(asText(payload));
    return found ? { ...found, source: "photo-knowledge" } : null;
  } catch {
    return null;
  }
}
