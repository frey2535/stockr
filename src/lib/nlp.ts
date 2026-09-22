export type ParsedAction = {
  action: "add" | "receive" | "return" | "transfer" | "use" | "count" | "find" | "shrink" | "adjust" | "delete" | null;
  quantity: number | null;
  itemQuery: string;
  toLocationName: string;
  fromLocationName: string;
  projectName: string;
};

export function foldQuery(value: string) {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9/.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

  if (/^(receive|received|receiving)\b/i.test(n)) {
    r.action = "receive";
    n = n.replace(/^(receive|received|receiving)\s*/i, "");
  } else if (/^(return|returned|returning)\b/i.test(n)) {
    r.action = "return";
    n = n.replace(/^(return|returned|returning)\s*/i, "");
  } else if (/^(count|counted|cycle)\b/i.test(n)) {
    r.action = "count";
    n = n.replace(/^(count|counted|cycle(?:\s+count)?)\s*/i, "");
  } else if (/^(add|added|adding|put|stock)\b/i.test(n)) {
    r.action = "add";
    n = n.replace(/^(add|added|adding|put|stock)\s*/i, "");
  } else if (/^(transfer|move|moved|send|sent)\b/i.test(n)) {
    r.action = "transfer";
    n = n.replace(/^(transfer|move|moved|send|sent)\s*/i, "");
  } else if (/^(shrink|shrinkage|lost|missing|write\s*off)\b/i.test(n)) {
    r.action = "shrink";
    n = n.replace(/^(shrink|shrinkage|lost|missing|write\s*off)\s*/i, "");
  } else if (/^(adjust|set|correct)\b/i.test(n)) {
    r.action = "adjust";
    n = n.replace(/^(adjust|set|correct)\s*/i, "");
  } else if (/^(delete|remove|void)\b/i.test(n)) {
    r.action = "delete";
    n = n.replace(/^(delete|remove|void)\s*/i, "");
  } else if (
    /^(use|used|using|consume|consumed|pull|pulled|install|installed)\b/i.test(n)
  ) {
    r.action = "use";
    n = n.replace(
      /^(use|used|using|consume|consumed|pull|pulled|install|installed)\s*/i,
      "",
    );
  } else if (/^(find|lookup|look up|search|where(?:'s| is)|locate)\b/i.test(n)) {
    r.action = "find";
    n = n.replace(/^(find|lookup|look up|search|where(?:'s| is)|locate)\s*/i, "");
  }

  const qty = n.match(/^(\d+(?:\.\d+)?)\s*/);
  if (qty) {
    r.quantity = parseFloat(qty[1]);
    n = n.replace(/^(\d+(?:\.\d+)?)\s*/, "");
  }

  const place = "([a-z0-9\\s#'._-]+?)";
  const to = n.match(new RegExp(`\\bto\\s+${place}(?:\\s+from\\s+|\\s+for\\s+|\\s+on\\s+|$)`, "i"));
  if (to) {
    r.toLocationName = to[1].trim();
    n = n.replace(to[0], " ").trim();
  }

  const from = n.match(new RegExp(`\\bfrom\\s+${place}(?:\\s+to\\s+|\\s+for\\s+|\\s+on\\s+|$)`, "i"));
  if (from) {
    r.fromLocationName = from[1].trim();
    n = n.replace(from[0], " ").trim();
  }

  const project = n.match(/\b(?:on|for)\s+(?:project\s+|job\s+)?([a-z0-9\s#'._-]+?)(?:\s+from\s+|\s+to\s+|$)/i);
  if (project && (r.action === "use" || r.action === "return")) {
    r.projectName = project[1].trim();
    n = n.replace(project[0], " ").trim();
  }

  r.itemQuery = n.replace(/\b(boxes?|units?|of)\b/gi, " ").replace(/\s+/g, " ").trim();
  return r;
}

export function scoreMatch(query: string, haystack: string) {
  const q = foldQuery(query);
  const h = foldQuery(haystack);
  if (!q || !h) return 0;
  if (h === q) return 3;
  if (h.includes(q) || q.includes(h)) return 2;
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return 0;
  const hits = words.filter((w) => h.includes(w)).length;
  return hits / words.length;
}

export function matchLocation<T extends { name: string; assigned_to?: string }>(
  name: string,
  locations: T[],
) {
  if (!name) return null;
  let best: T | null = null;
  let score = 0;
  for (const loc of locations) {
    let s = scoreMatch(name, loc.name);
    if (loc.assigned_to) s = Math.max(s, scoreMatch(name, loc.assigned_to) * 1.05);
    if (s > score) {
      score = s;
      best = loc;
    }
  }
  return score > 0.3 ? best : null;
}

export function matchMaterial<T extends { name: string; aliases?: string[]; barcode?: string; mpn?: string }>(
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
    if (m.barcode) s = Math.max(s, scoreMatch(query, m.barcode));
    if (m.mpn) s = Math.max(s, scoreMatch(query, m.mpn));
    if (s > score) {
      score = s;
      best = m;
    }
  }
  return { match: score > 0.3 ? best : null, score };
}
