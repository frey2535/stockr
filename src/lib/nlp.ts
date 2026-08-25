export type ParsedAction = {
  action: "add" | "transfer" | "use" | "find" | null;
  quantity: number | null;
  itemQuery: string;
  toLocationName: string;
  fromLocationName: string;
  projectName: string;
};

export function parseInventoryEnglish(input: string): ParsedAction {
  const e = input.trim();
  if (!e) {
    return {
      action: null,
      quantity: null,
      itemQuery: "",
      toLocationName: "",
      fromLocationName: "",
      projectName: "",
    };
  }

  let n = e;
  const r: ParsedAction = {
    action: null,
    quantity: null,
    itemQuery: "",
    toLocationName: "",
    fromLocationName: "",
    projectName: "",
  };

  if (/^(add|added|adding|put|stock|receive|received)\b/i.test(n)) {
    r.action = "add";
    n = n.replace(/^(add|added|adding|put|stock|receive|received)\s*/i, "");
  } else if (/^(transfer|move|moved|send|sent)\b/i.test(n)) {
    r.action = "transfer";
    n = n.replace(/^(transfer|move|moved|send|sent)\s*/i, "");
  } else if (
    /^(use|used|using|consume|consumed|pull|pulled|install|installed)\b/i.test(n)
  ) {
    r.action = "use";
    n = n.replace(
      /^(use|used|using|consume|consumed|pull|pulled|install|installed)\s*/i,
      "",
    );
  } else if (/^(find|lookup|look up|search)\b/i.test(n)) {
    r.action = "find";
    n = n.replace(/^(find|lookup|look up|search)\s*/i, "");
  }

  const qty = n.match(/^(\d+(?:\.\d+)?)\s*/);
  if (qty) {
    r.quantity = parseFloat(qty[1]);
    n = n.replace(/^(\d+(?:\.\d+)?)\s*/, "");
  }

  const to = n.match(
    /\bto\s+([a-z0-9\s#_-]+?)(?:\s+from\s+|\s+for\s+|\s+on\s+|$)/i,
  );
  if (to) {
    r.toLocationName = to[1].trim();
    n = n.replace(to[0], " ").trim();
  }

  const from = n.match(
    /\bfrom\s+([a-z0-9\s#_-]+?)(?:\s+to\s+|\s+for\s+|\s+on\s+|$)/i,
  );
  if (from) {
    r.fromLocationName = from[1].trim();
    n = n.replace(from[0], " ").trim();
  }

  const project = n.match(
    /\b(?:on|for)\s+(?:project\s+)?([a-z0-9\s#_-]+?)(?:\s+from\s+|\s+to\s+|$)/i,
  );
  if (project && r.action === "use") {
    r.projectName = project[1].trim();
    n = n.replace(project[0], " ").trim();
  }

  r.itemQuery = n.replace(/\b(boxes?|units?|of)\b/gi, " ").replace(/\s+/g, " ").trim();
  return r;
}

export function scoreMatch(query: string, haystack: string) {
  const q = query.toLowerCase().trim();
  const h = haystack.toLowerCase();
  if (!q || !h) return 0;
  if (h === q) return 3;
  if (h.includes(q)) return 2;
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return 0;
  const hits = words.filter((w) => h.includes(w)).length;
  return hits / words.length;
}

export function matchLocation<T extends { name: string }>(
  name: string,
  locations: T[],
) {
  if (!name) return null;
  let best: T | null = null;
  let score = 0;
  for (const loc of locations) {
    const s = scoreMatch(name, loc.name);
    if (s > score) {
      score = s;
      best = loc;
    }
  }
  return score > 0.3 ? best : null;
}

export function matchMaterial<T extends { name: string; aliases?: string[] }>(
  query: string,
  materials: T[],
) {
  if (!query) return { match: null as T | null, score: 0 };
  let best: T | null = null;
  let score = 0;
  for (const m of materials) {
    let s = scoreMatch(query, m.name);
    if (Array.isArray(m.aliases)) {
      for (const a of m.aliases) s = Math.max(s, scoreMatch(query, a) * 1.1);
    }
    if (s > score) {
      score = s;
      best = m;
    }
  }
  return { match: score > 0.3 ? best : null, score };
}
