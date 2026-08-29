/**
 * Fast, forgiving search across all material fields.
 * Supports: name, barcode, manufacturer, category, sub_category, supplier, aliases.
 * Scores by relevance and returns ranked results.
 */

// Common misspelling map (expand as needed)
const MISSPELLING_MAP = {
  "cupling": "coupling",
  "couling": "coupling",
  "coppling": "coupling",
  "wirenuts": "wire nuts",
  "wirenot": "wire nut",
  "condut": "conduit",
  "conduit": "conduit",
  "recpticle": "receptacle",
  "recptical": "receptacle",
  "recepticle": "receptacle",
  "breaker": "breaker",
  "braker": "breaker",
  "pannelboard": "panelboard",
  "pannel": "panel",
  "juntcion": "junction",
  "jucntion": "junction",
  "switchbox": "switch box",
  "swtich": "switch",
  "romex": "nm cable",
  "thhn": "thhn",
};

function normalizeQuery(q) {
  let lower = q.toLowerCase().trim();
  // Replace known misspellings
  for (const [typo, fix] of Object.entries(MISSPELLING_MAP)) {
    lower = lower.replace(new RegExp(`\\b${typo}\\b`, "g"), fix);
  }
  return lower;
}

function tokenize(str) {
  return (str || "").toLowerCase().replace(/[^a-z0-9\s\/]/g, " ").split(/\s+/).filter(w => w.length > 0);
}

function scoreMatch(queryTokens, haystack) {
  const haystackTokens = tokenize(haystack);
  let score = 0;
  for (const qt of queryTokens) {
    for (const ht of haystackTokens) {
      if (ht === qt) { score += 2; break; }
      if (ht.startsWith(qt) || qt.startsWith(ht)) { score += 1.5; break; }
      if (ht.includes(qt) || qt.includes(ht)) { score += 1; break; }
    }
  }
  return score;
}

export function searchMaterials(query, materials, options = {}) {
  const { recentIds = [], limit = 10 } = options;

  if (!query || !query.trim()) {
    // No query: return recent items first, then rest
    if (recentIds.length > 0) {
      const recentSet = new Set(recentIds);
      const recentMats = recentIds
        .map(id => materials.find(m => m.id === id))
        .filter(Boolean);
      const rest = materials.filter(m => !recentSet.has(m.id)).slice(0, limit - recentMats.length);
      return [...recentMats, ...rest].slice(0, limit);
    }
    return materials.slice(0, limit);
  }

  const normalized = normalizeQuery(query);
  const queryTokens = tokenize(normalized);
  if (queryTokens.length === 0) return materials.slice(0, limit);

  const scored = materials.map(m => {
    let score = 0;

    // Name — highest weight
    score += scoreMatch(queryTokens, m.name) * 3;

    // Barcode — exact match gets big bonus
    if (m.barcode && m.barcode.toLowerCase().includes(normalized)) score += 10;

    // Manufacturer
    score += scoreMatch(queryTokens, m.manufacturer) * 1.5;

    // Category / sub_category
    score += scoreMatch(queryTokens, m.category) * 1.2;
    score += scoreMatch(queryTokens, m.sub_category) * 1.2;

    // Supplier / SKU
    score += scoreMatch(queryTokens, m.supplier) * 1.5;

    // Aliases
    if (Array.isArray(m.aliases)) {
      for (const alias of m.aliases) {
        score += scoreMatch(queryTokens, alias) * 2;
      }
    }

    // Recent item bonus
    const recentIdx = recentIds.indexOf(m.id);
    if (recentIdx >= 0) score += Math.max(0, 3 - recentIdx * 0.3);

    return { ...m, _score: score };
  });

  return scored
    .filter(m => m._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);
}

/**
 * Parse typed intent from a string.
 * Returns: { action, quantity, itemQuery, toLocationName, fromLocationName, projectName }
 */
export function parseIntent(text) {
  const raw = text.trim();
  if (!raw) return { itemQuery: "" };

  let remaining = raw;
  const result = {
    action: null,
    quantity: null,
    itemQuery: "",
    toLocationName: "",
    fromLocationName: "",
    projectName: "",
  };

  // Action detection
  if (/^(add|added|adding|put|stock|receive|received)\b/i.test(remaining)) {
    result.action = "add";
    remaining = remaining.replace(/^(add|added|adding|put|stock|receive|received)\s*/i, "");
  } else if (/^(transfer|move|moved|send|sent)\b/i.test(remaining)) {
    result.action = "transfer";
    remaining = remaining.replace(/^(transfer|move|moved|send|sent)\s*/i, "");
  } else if (/^(use|used|using|consume|consumed|pull|pulled|install|installed)\b/i.test(remaining)) {
    result.action = "use";
    remaining = remaining.replace(/^(use|used|using|consume|consumed|pull|pulled|install|installed)\s*/i, "");
  }

  // Quantity detection
  const qtyMatch = remaining.match(/^(\d+(?:\.\d+)?)\s*/);
  if (qtyMatch) {
    result.quantity = parseFloat(qtyMatch[1]);
    remaining = remaining.replace(/^(\d+(?:\.\d+)?)\s*/, "");
  }

  // To location
  const toMatch = remaining.match(/\bto\s+([a-z0-9\s#_-]+?)(?:\s+from\s+|\s+for\s+|\s+on\s+|$)/i);
  if (toMatch) {
    result.toLocationName = toMatch[1].trim();
    remaining = remaining.replace(toMatch[0], " ").trim();
  }

  // From location
  const fromMatch = remaining.match(/\bfrom\s+([a-z0-9\s#_-]+?)(?:\s+to\s+|\s+for\s+|\s+on\s+|$)/i);
  if (fromMatch) {
    result.fromLocationName = fromMatch[1].trim();
    remaining = remaining.replace(fromMatch[0], " ").trim();
  }

  // Project
  const projMatch = remaining.match(/\b(?:on|for)\s+(?:project\s+)?([a-z0-9\s#_-]+?)(?:\s+from\s+|\s+to\s+|$)/i);
  if (projMatch && result.action === "use") {
    result.projectName = projMatch[1].trim();
    remaining = remaining.replace(projMatch[0], " ").trim();
  }

  result.itemQuery = remaining.trim();
  return result;
}