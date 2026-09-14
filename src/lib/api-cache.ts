type CacheEntry = { data: unknown; at: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

export function readApiCache<T>(url: string): T | undefined {
  const entry = cache.get(url);
  return entry ? (entry.data as T) : undefined;
}

export function writeApiCache(url: string, data: unknown) {
  cache.set(url, { data, at: Date.now() });
}

export function invalidateApiCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key === prefix || key.startsWith(prefix)) cache.delete(key);
  }
}

export async function fetchApiJson<T>(url: string): Promise<T> {
  const pending = inflight.get(url);
  if (pending) return pending as Promise<T>;

  const request = fetch(url)
    .then(async (response) => {
      const json = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
      if (!response.ok) {
        const message =
          json && typeof json === "object" && "error" in json ? String(json.error) : "Could not load data.";
        throw new Error(message);
      }
      writeApiCache(url, json);
      return json as T;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, request);
  return request;
}

export function prefetchApi(url: string) {
  if (typeof window === "undefined") return;
  if (cache.has(url) || inflight.has(url)) return;
  void fetchApiJson(url).catch(() => undefined);
}
