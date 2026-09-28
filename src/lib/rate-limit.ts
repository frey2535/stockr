const buckets = new Map<string, { count: number; resetAt: number }>();

function supabaseReady() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function rateLimitMemory(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const, remaining: limit - 1 };
  }
  if (current.count >= limit) {
    return { ok: false as const, remaining: 0, retryAfterMs: current.resetAt - now };
  }
  current.count += 1;
  return { ok: true as const, remaining: limit - current.count };
}

export async function rateLimit(key: string, limit: number, windowMs: number) {
  if (supabaseReady()) {
    try {
      const { getSupabaseAdmin } = await import("./supabase-admin");
      const { data, error } = await getSupabaseAdmin().rpc("stockr_rate_hit", {
        p_key: key,
        p_limit: limit,
        p_window_ms: windowMs,
      });
      if (!error && data && typeof data === "object") {
        const row = data as { ok?: boolean; remaining?: number };
        return { ok: Boolean(row.ok), remaining: Number(row.remaining || 0) };
      }
    } catch {
      // Preview or missing SQL falls back to this isolate.
    }
  }
  return rateLimitMemory(key, limit, windowMs);
}

export function clientKey(request: Request, extra = "") {
  const forwarded = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || "local";
  return `${ip}:${extra}`;
}
