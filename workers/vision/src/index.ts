type Env = {
  AI: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };
  VISION_SECRET?: string;
};

const NAME_PROMPT =
  "You are Google Lens for contractor materials and packaged goods. Look at the OBJECT, not a barcode. Name the main commercial product you actually see: brand + trade name + catalog number if known. If the photo is one item, write one line only. Do not list alternate SKUs, attributes, or guesses. Only add another line when a physically different product is visible. No intro, no bullets, no JSON.";

const JSON_PROMPT =
  "Turn these visually recognized products into inventory identity JSON. If the input is one product described several ways, return exactly one object. Only return multiple objects for physically different products. Fill the standard UPC/EAN barcode and manufacturer catalog number (MPN) when the exact SKU is known. Return only JSON { objects: [{ name, brand, manufacturer, barcode, upc, mpn, search_queries }] }.";

const DETECT_PROMPT =
  "Look at this photo. Identify the commercial product you actually see. If the photo is one item, return exactly one object. Do not list alternate SKUs, attributes, or guesses as extra objects. Only add another object when a physically different product is visible. Return only JSON { objects: [{ name, brand, manufacturer, barcode, upc, mpn, search_queries }] }.";

function asText(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.response === "string") return record.response;
  if (typeof record.result === "string") return record.result;
  if (record.result && typeof record.result === "object") {
    const inner = record.result as Record<string, unknown>;
    if (typeof inner.response === "string") return inner.response;
  }
  const choices = record.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    return String((choices[0] as { message?: { content?: string } }).message?.content || "");
  }
  return "";
}

function parseJson(raw: string) {
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

function linesToObjects(raw: string) {
  const lines = raw
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.)\]]+\s*/, "").trim())
    .filter((line) => line.length >= 6 && line.length <= 80)
    .filter((line) => !/^(here|json|sure|the image|i see|objects|this|it |possibly|maybe|could|also|or )\b/i.test(line))
    .filter((line) => /\d/.test(line) || /\b[A-Z]{2,}[A-Z0-9-]{2,}\b/.test(line));
  const chosen = (lines.length ? lines : raw.split(/\n+/).map((line) => line.trim()).filter((line) => line.length >= 6)).slice(0, 1);
  return chosen.map((name) => ({ name, brand: "", barcode: "", mpn: "", search_queries: [name] }));
}

function collapseObjects(objects: Array<Record<string, string | string[]>>) {
  if (objects.length <= 1) return objects;
  const keys = objects
    .map((row) => String(row.mpn || row.barcode || "").replace(/\W/g, "").toLowerCase())
    .filter(Boolean);
  if (new Set(keys).size > 1) return objects.slice(0, 6);
  const best = objects.find((row) => row.barcode || row.mpn) || objects[0];
  return best ? [best] : objects.slice(0, 1);
}

function objectsFrom(raw: string) {
  const parsed = parseJson(raw);
  if (parsed && typeof parsed === "object") {
    const record = parsed as { objects?: unknown[]; items?: unknown[]; name?: string };
    const rows = Array.isArray(record.objects) ? record.objects : Array.isArray(record.items) ? record.items : record.name ? [record] : [];
    const objects = rows
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const item = row as Record<string, unknown>;
        const name = String(item.name || item.title || item.product || item.product_name || "").trim();
        if (!name) return null;
        return {
          name,
          brand: String(item.brand || item.manufacturer || "").trim(),
          manufacturer: String(item.manufacturer || item.brand || "").trim(),
          barcode: String(item.barcode || item.upc || item.ean || "").trim(),
          upc: String(item.upc || item.barcode || "").trim(),
          mpn: String(item.mpn || item.sku || item.part_number || "").trim(),
          search_queries: Array.isArray(item.search_queries)
            ? item.search_queries.map((query) => String(query || "").trim()).filter(Boolean)
            : [name],
        };
      })
      .filter(Boolean);
    if (objects.length) return collapseObjects(objects as Array<Record<string, string | string[]>>);
  }
  return collapseObjects(linesToObjects(raw));
}

function splitImage(image: string) {
  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], base64: match[2], dataUrl: image };
}

async function run(env: Env, model: string, input: Record<string, unknown>) {
  return env.AI.run(model, input);
}

async function detectJson(env: Env, image: string) {
  const parts = splitImage(image);
  if (!parts) return [];
  try {
    const scout = await run(env, "@cf/meta/llama-4-scout-17b-16e-instruct", {
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: DETECT_PROMPT },
            { type: "image_url", image_url: { url: parts.dataUrl } },
          ],
        },
      ],
    });
    return objectsFrom(asText(scout).trim());
  } catch {
    return [];
  }
}

async function caption(env: Env, image: string) {
  const parts = splitImage(image);
  if (!parts) return "";
  try {
    const scout = await run(env, "@cf/meta/llama-4-scout-17b-16e-instruct", {
      temperature: 0,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: NAME_PROMPT },
            { type: "image_url", image_url: { url: parts.dataUrl } },
          ],
        },
      ],
    });
    const text = asText(scout).trim();
    if (text) return text;
  } catch {
    /* try llama 3.2 */
  }
  try {
    await run(env, "@cf/meta/llama-3.2-11b-vision-instruct", { prompt: "agree" });
    const llama = await run(env, "@cf/meta/llama-3.2-11b-vision-instruct", {
      prompt: NAME_PROMPT,
      image: parts.base64,
      max_tokens: 400,
      temperature: 0,
    });
    return asText(llama).trim();
  } catch {
    return "";
  }
}

async function complete(env: Env, names: string) {
  if (!names.trim()) return [];
  try {
    const payload = await run(env, "@cf/meta/llama-4-scout-17b-16e-instruct", {
      temperature: 0,
      max_tokens: 700,
      messages: [
        { role: "system", content: JSON_PROMPT },
        { role: "user", content: names },
      ],
    });
    return objectsFrom(asText(payload));
  } catch {
    return objectsFrom(names);
  }
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === "GET") {
      return Response.json({ ok: true, service: "stockr-vision" });
    }
    if (request.method !== "POST") {
      return Response.json({ error: "method not allowed" }, { status: 405 });
    }
    const secret = env.VISION_SECRET?.trim();
    const auth = request.headers.get("authorization") || "";
    if (secret && auth !== `Bearer ${secret}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = (await request.json().catch(() => null)) as { image?: string } | null;
    const image = String(body?.image || "");
    if (!image.startsWith("data:image")) {
      return Response.json({ objects: [], error: "Send a photo." }, { status: 400 });
    }
    const direct = await detectJson(env, image);
    if (direct.length) {
      return Response.json({ objects: direct });
    }
    const named = await caption(env, image);
    const objects = named ? await complete(env, named) : [];
    if (!objects.length && named) {
      return Response.json({ objects: objectsFrom(named), caption: named });
    }
    return Response.json({ objects, caption: named || undefined });
  },
};
