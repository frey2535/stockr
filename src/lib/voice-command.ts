import { matchLocation, matchMaterial, parseInventoryEnglish, type ParsedAction } from "./nlp.ts";
import { needsFrom, needsProject, needsTo } from "./tx.ts";
import type { InventoryAction, Location, Material, Project, TxType } from "./types.ts";

export type VoiceResult =
  | { ok: false; error: string; spoken: string; parsed: ParsedAction; create?: boolean }
  | { ok: true; kind: "find"; material: Material; spoken: string; parsed: ParsedAction }
  | { ok: true; kind: "action"; action: InventoryAction; spoken: string; parsed: ParsedAction }
  | { ok: true; kind: "delete"; material: Material; spoken: string; parsed: ParsedAction };

function pickLocation(name: string, locations: Location[]) {
  return matchLocation(name, locations) || (locations.length === 1 ? locations[0] : null);
}

function pickProject(name: string, projects: Project[]) {
  if (!name.trim()) return "";
  const exact = projects.find((row) => row.name.toLowerCase() === name.toLowerCase());
  if (exact) return exact.name;
  const folded = name.toLowerCase();
  const partial = projects.find(
    (row) => row.name.toLowerCase().includes(folded) || folded.includes(row.name.toLowerCase()),
  );
  return partial?.name || name;
}

export function voiceSearchQuery(transcript: string) {
  const parsed = parseInventoryEnglish(transcript);
  return parsed.itemQuery.trim() || transcript.trim();
}

export function planVoiceCommand(
  transcript: string,
  materials: Material[],
  locations: Location[],
  projects: Project[] = [],
): VoiceResult {
  const parsed = parseInventoryEnglish(transcript);
  const { match } = matchMaterial(parsed.itemQuery, materials);
  const from = pickLocation(parsed.fromLocationName, locations);
  const to = pickLocation(parsed.toLocationName, locations);
  const project = pickProject(parsed.projectName, projects);

  if (!parsed.action) {
    return { ok: false, error: "I did not hear an inventory action.", spoken: "Say use, transfer, add, return, or find.", parsed };
  }
  if (!match) {
    return {
      ok: false,
      create: Boolean(parsed.itemQuery),
      error: parsed.itemQuery
        ? `No catalog match for “${parsed.itemQuery}”. Add it to the catalog and inventory.`
        : "Name the material.",
      spoken: parsed.itemQuery ? "That item is not in the catalog yet. Add it on screen." : "I could not match that material.",
      parsed,
    };
  }
  if (parsed.action === "find") {
    return { ok: true, kind: "find", material: match, spoken: `Found ${match.name}.`, parsed };
  }
  if (parsed.action === "delete") {
    return { ok: true, kind: "delete", material: match, spoken: `Ready to delete ${match.name}. Confirm on screen.`, parsed };
  }

  const type = parsed.action as TxType;
  if (needsFrom(type) && !from) {
    return { ok: false, error: "Which location should I take it from?", spoken: "Name the source van or shop.", parsed };
  }
  if (needsTo(type) && !to) {
    return { ok: false, error: "Which location should I send it to?", spoken: "Name the destination.", parsed };
  }
  if (needsProject(type) && !project.trim()) {
    return { ok: false, error: "Which job is this for?", spoken: "Name the job.", parsed };
  }

  const quantity = parsed.quantity && parsed.quantity > 0 ? parsed.quantity : 1;
  const action: InventoryAction = {
    type,
    materialId: match.id,
    quantity,
    fromLocationId: needsFrom(type) ? from!.id : null,
    toLocationId: needsTo(type) ? to!.id : null,
    project: needsProject(type) ? project : null,
    notes: `Voice: ${transcript.trim()}`,
  };
  return {
    ok: true,
    kind: "action",
    action,
    spoken: `${type} ${quantity} ${match.name}${from ? ` from ${from.name}` : ""}${to ? ` to ${to.name}` : ""}${project ? ` on ${project}` : ""}.`,
    parsed,
  };
}
