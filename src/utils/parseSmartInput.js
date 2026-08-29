/**
 * Rule-based parser for smart inventory input phrases.
 * Returns a parsed result object with a confidence score (0-1).
 * Only falls back to LLM when confidence < 0.5.
 */

const ACTION_PATTERNS = [
  { pattern: /^(add|added|adding|put|stock|receive|received)\b/i, type: "add" },
  { pattern: /^(transfer|move|moved|moving|send|sent)\b/i, type: "transfer" },
  { pattern: /^(use|used|using|consume|consumed|pull|pulled|install|installed)\b/i, type: "use" },
  { pattern: /^(find|search|look\s*up|check|how\s*many|locate)\b/i, type: "find" },
];

// Fractional sizes like 3/4", 1/2", 4-11/16"
const SIZE_PATTERN = /(\d+(?:-\d+\/\d+)?(?:\/\d+)?)\s*(?:"|inch|inches|in\b)/i;

// Quantity at start: "10", "1 case of", "25"
const QTY_PATTERN = /^(\d+(?:\.\d+)?)\s*(case[s]?\s+of|box(?:es)?\s+of|roll[s]?\s+of|bag[s]?\s+of)?\s*/i;

const UNIT_KEYWORDS = ["case", "cases", "box", "boxes", "roll", "rolls", "bag", "bags", "ft", "feet", "each", "pc", "pcs", "piece", "pieces", "length", "lengths"];

const FROM_PATTERNS = [
  /\bfrom\s+(.+?)(?:\s+to\s+|\s+for\s+|\s+on\s+|$)/i,
];
const TO_PATTERNS = [
  /\bto\s+(.+?)(?:\s+from\s+|\s+for\s+|\s+on\s+|$)/i,
  /\bat\s+(.+?)(?:\s+from\s+|\s+for\s+|\s+on\s+|$)/i,
];
const PROJECT_PATTERNS = [
  /\b(?:on|for)\s+(?:project\s+)?(.+?)(?:\s+from\s+|\s+to\s+|$)/i,
];

// Category detection is intentionally left to the LLM or manual entry
// so the app works for any industry, not just electrical.
function detectCategory() {
  return "";
}

function fuzzyMatchLocation(name, locations) {
  if (!name || !locations.length) return null;
  const lower = name.trim().toLowerCase();
  // Exact match first
  const exact = locations.find(l => l.name.toLowerCase() === lower);
  if (exact) return exact;
  // Partial match
  const partial = locations.find(l =>
    l.name.toLowerCase().includes(lower) || lower.includes(l.name.toLowerCase())
  );
  return partial || null;
}

function fuzzyMatchMaterial(description, materials, extractedSize = "") {
  if (!description || !materials.length) return { match: null, score: 0 };
  const lower = description.toLowerCase();
  let best = null;
  let bestScore = 0;
  
  for (const m of materials) {
    const mName = (m.name || "").toLowerCase();
    
    // Check how many words overlap
    const descWords = lower.split(/\s+/).filter(w => w.length > 2);
    const nameWords = mName.split(/\s+/).filter(w => w.length > 2);
    const overlap = descWords.filter(w => nameWords.some(nw => nw.includes(w) || w.includes(nw)));
    let score = overlap.length / Math.max(descWords.length, nameWords.length);
    
    // Size matching bonus: if description has a size, boost score only if material name contains that size
    if (extractedSize && mName.includes(extractedSize.toLowerCase())) {
      score += 0.2; // Bonus for exact size match
    } else if (extractedSize && !mName.includes(extractedSize.toLowerCase())) {
      score -= 0.15; // Penalty for size mismatch
    }
    
    // Ensure score stays in valid range
    score = Math.min(1, Math.max(0, score));
    
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return { match: bestScore > 0.3 ? best : null, score: bestScore };
}

export function parseSmartInput(text, { materials = [], locations = [], projects = [] } = {}) {
  const raw = text.trim();
  if (!raw) return null;

  let remaining = raw;
  let confidence = 0;
  const result = {
    raw_text: raw,
    action_type: "add",
    quantity: 1,
    unit: "each",
    material_description: "",
    normalized_item_name: "",
    size: "",
    category: "",
    from_location: null,
    to_location: null,
    project: "",
    matched_material: null,
    material_match_score: 0,
    confidence: 0,
    needs_llm: false,
  };

  // 1. Detect action
  let actionFound = false;
  for (const { pattern, type } of ACTION_PATTERNS) {
    if (pattern.test(remaining)) {
      result.action_type = type;
      remaining = remaining.replace(pattern, "").trim();
      actionFound = true;
      confidence += 0.2;
      break;
    }
  }
  // If no explicit action, default to "add" — lower confidence boost
  if (!actionFound) confidence += 0.05;

  // 2. Extract quantity
  const qtyMatch = remaining.match(QTY_PATTERN);
  if (qtyMatch) {
    result.quantity = parseFloat(qtyMatch[1]);
    if (qtyMatch[2]) {
      // "case of", "box of" etc — treat as unit
      result.unit = qtyMatch[2].trim().replace(/\s+of$/, "");
    }
    remaining = remaining.replace(QTY_PATTERN, "").trim();
    confidence += 0.2;
  }

  // 3. Extract size (e.g. 3/4", 1/2", 4-11/16")
  const sizeMatch = remaining.match(SIZE_PATTERN);
  if (sizeMatch) {
    result.size = sizeMatch[0].trim();
    confidence += 0.1;
  }

  // 4. Extract from/to locations
  for (const pat of FROM_PATTERNS) {
    const m = remaining.match(pat);
    if (m) {
      const loc = fuzzyMatchLocation(m[1].trim(), locations);
      if (loc) { result.from_location = loc; confidence += 0.1; }
    }
  }
  for (const pat of TO_PATTERNS) {
    const m = remaining.match(pat);
    if (m) {
      const loc = fuzzyMatchLocation(m[1].trim(), locations);
      if (loc) { result.to_location = loc; confidence += 0.1; }
    }
  }

  // 5. Extract project
  for (const pat of PROJECT_PATTERNS) {
    const m = remaining.match(pat);
    if (m) {
      const candidate = m[1].trim();
      // Only treat as project if action is "use" or keyword "project" was present
      if (result.action_type === "use" || /project/i.test(remaining)) {
        result.project = candidate;
        confidence += 0.05;
      }
    }
  }

  // 6. Strip location/project clauses to isolate material description
  let desc = remaining
    .replace(/\bfrom\s+.+?(\s+to\s+|\s+for\s+|\s+on\s+|$)/i, " ")
    .replace(/\bto\s+.+?(\s+from\s+|\s+for\s+|\s+on\s+|$)/i, " ")
    .replace(/\bfor\s+(?:project\s+)?.+$/i, "")
    .replace(/\bon\s+(?:project\s+)?.+$/i, "")
    .trim();

  result.material_description = desc;
  result.normalized_item_name = desc;

  // 7. Detect category from description
  result.category = detectCategory(desc);
  if (result.category) confidence += 0.05;

  // 8. Fuzzy match against existing materials (pass extracted size for better matching)
  const { match, score } = fuzzyMatchMaterial(desc, materials, result.size);
  result.matched_material = match;
  result.material_match_score = score;
  if (match) confidence += 0.2;

  // 9. Final confidence cap and LLM flag
  result.confidence = Math.min(confidence, 1);
  result.needs_llm = result.confidence < 0.45 || !result.material_description;

  return result;
}