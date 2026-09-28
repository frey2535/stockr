import type { IdentifiedProduct } from "./types";
import { collapseVisionObjects, mergeIdentities, parseVisionObjects, parseVisionText } from "./identify-photo";
import { matchKnownProduct } from "./known-products";

export const LENS_PROMPT =
  "You are Google Lens for contractor materials, tools, and packaged goods. Look at the OBJECT itself — shape, color, brand marks, packaging, form factor. A printed barcode is not required. If the photo is one product, return exactly one object. Do not list alternate SKUs, attributes, or guesses as extra objects. Only add another object when a physically different product is visible. Same SKU more than once is one object with quantity. Return the exact trade name a supplier would use, the standard UPC/EAN, and the manufacturer catalog number (MPN). Read digits when visible; if not visible but the SKU is known, fill the well-known UPC and catalog number. Return JSON { objects: [{ name, brand, manufacturer, barcode, upc, mpn, category, description, quantity, search_queries, box: { x, y, w, h } }] }. box values are 0-1 fractions of the image.";

const IDENTITY_PROMPT =
  "You complete product identity for field inventory. The item was already recognized visually. Return the canonical trade name, the standard UPC/EAN barcode, and the manufacturer catalog number (MPN) for that exact SKU. Fill barcode and MPN from product knowledge when the SKU is known. Return JSON { name, brand, manufacturer, barcode, upc, mpn, search_queries }.";

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

function splitImage(image: string) {
  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], base64: match[2], dataUrl: image };
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

function visionWorkerUrl() {
  return process.env.STOCKR_VISION_URL?.trim() || "";
}

function visionWorkerSecret() {
  return process.env.STOCKR_VISION_SECRET?.trim() || process.env.CLOUDFLARE_API_TOKEN?.trim() || "";
}

function enrichKnown(objects: IdentifiedProduct[]) {
  return collapseVisionObjects(
    objects.map((object) => {
      const known = matchKnownProduct([object.brand, object.name, object.mpn, ...(object.search_queries || [])].filter(Boolean).join(" "));
      return known ? mergeIdentities(object, known) : object;
    }),
  );
}

export function hasVisionProvider() {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      visionWorkerUrl() ||
      process.env.CLOUDFLARE_ACCOUNT_ID?.trim(),
  );
}

export async function canUseVision() {
  if (hasVisionProvider()) return true;
  return Boolean(await workersAiBinding());
}

async function withTimeout<T>(work: Promise<T>, ms: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runWorkersAi(model: string, input: Record<string, unknown>) {
  const binding = await workersAiBinding();
  if (binding) {
    try {
      const payload = await withTimeout(binding.run(model, input), 18000, "Workers AI");
      return { ok: true as const, payload };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Workers AI failed." };
    }
  }
  const rest = workersAiRest();
  if (!rest) return { ok: false as const, error: "Workers AI is not bound." };
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(rest.account)}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${rest.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(18000),
      },
    );
    const data = (await response.json().catch(() => null)) as { result?: unknown; success?: boolean; errors?: Array<{ message?: string }> } | null;
    if (!response.ok) {
      const message = data?.errors?.[0]?.message || `Workers AI ${response.status}`;
      return { ok: false as const, error: message };
    }
    return { ok: true as const, payload: data?.result ?? data };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Workers AI failed." };
  }
}

function objectsFromPayload(payload: unknown) {
  return parseVisionObjects(parseModelJson(asText(payload)));
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
            { type: "text", text: "Look at the objects in this photo. Identify each product from appearance. A barcode does not have to be visible." },
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
  const parts = splitImage(image);
  if (!parts) return [];
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
              { text: `${LENS_PROMPT}\nLook at the objects in this photo. Identify each product from appearance. A barcode does not have to be visible.` },
              { inline_data: { mime_type: parts.mime, data: parts.base64 } },
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

async function detectObjectsWithWorkersAi(image: string) {
  const parts = splitImage(image);
  if (!parts) return { objects: [] as IdentifiedProduct[], error: "That photo could not be read." };
  const prompt = `${LENS_PROMPT}\nLook at the objects in this photo. Identify each product from appearance. A barcode does not have to be visible. JSON only.`;
  const attempts: Array<() => Promise<{ objects: IdentifiedProduct[]; error?: string }>> = [
    async () => {
      const run = await runWorkersAi("@cf/meta/llama-4-scout-17b-16e-instruct", {
        temperature: 0,
        max_tokens: 1024,
        messages: [
          { role: "system", content: LENS_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Identify each product from appearance. A barcode does not have to be visible. JSON only." },
              { type: "image_url", image_url: { url: parts.dataUrl } },
            ],
          },
        ],
      });
      if (!run.ok) return { objects: [], error: run.error };
      return { objects: objectsFromPayload(run.payload) };
    },
    async () => {
      await runWorkersAi("@cf/meta/llama-3.2-11b-vision-instruct", { prompt: "agree" });
      const run = await runWorkersAi("@cf/meta/llama-3.2-11b-vision-instruct", {
        prompt,
        image: parts.base64,
        max_tokens: 1024,
        temperature: 0,
      });
      if (!run.ok) return { objects: [], error: run.error };
      return { objects: objectsFromPayload(run.payload) };
    },
  ];

  let lastError = "";
  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (result.objects.length) return result;
      if (result.error) lastError = result.error;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Vision failed.";
    }
  }
  return { objects: [] as IdentifiedProduct[], error: lastError || "Vision did not recognize an item in this photo." };
}

async function detectObjectsWithVisionWorker(image: string) {
  const url = visionWorkerUrl();
  if (!url) return { objects: [] as IdentifiedProduct[], error: "" };
  try {
    const response = await fetch(url.replace(/\/$/, ""), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(visionWorkerSecret() ? { Authorization: `Bearer ${visionWorkerSecret()}` } : {}),
      },
      body: JSON.stringify({ image }),
      signal: AbortSignal.timeout(28000),
    });
    const data = (await response.json().catch(() => null)) as { objects?: unknown; caption?: string; error?: string } | null;
    if (!response.ok) return { objects: [] as IdentifiedProduct[], error: data?.error || `Vision worker ${response.status}` };
    const fromJson = parseVisionObjects({ objects: data?.objects });
    const objects = fromJson.length ? fromJson : parseVisionText(String(data?.caption || ""));
    return { objects: enrichKnown(objects), error: objects.length ? undefined : data?.error };
  } catch (error) {
    return { objects: [] as IdentifiedProduct[], error: error instanceof Error ? error.message : "Vision worker failed." };
  }
}

export async function detectObjectsFromVision(image: string): Promise<{ objects: IdentifiedProduct[]; error?: string }> {
  if (!image.startsWith("data:image")) return { objects: [] };
  try {
    const worker = await detectObjectsWithVisionWorker(image);
    if (worker.objects.length) return worker;
    const openai = enrichKnown(await detectObjectsWithOpenAI(image));
    if (openai.length) return { objects: openai };
    const gemini = enrichKnown(await detectObjectsWithGemini(image));
    if (gemini.length) return { objects: gemini };
    const fallback = await detectObjectsWithWorkersAi(image);
    return { objects: enrichKnown(fallback.objects), error: fallback.objects.length ? undefined : worker.error || fallback.error };
  } catch (error) {
    return { objects: [], error: error instanceof Error ? error.message : "Vision failed." };
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

    const run = await runWorkersAi("@cf/meta/llama-4-scout-17b-16e-instruct", {
      temperature: 0,
      max_tokens: 512,
      messages: [
        { role: "system", content: IDENTITY_PROMPT },
        { role: "user", content: hint },
      ],
    });
    if (!run.ok) return null;
    const found = await ask(asText(run.payload));
    return found ? { ...found, source: "photo-knowledge" } : null;
  } catch {
    return null;
  }
}
