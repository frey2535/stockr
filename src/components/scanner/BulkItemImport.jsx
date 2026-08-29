import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, AlertTriangle, Package, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function extractSize(text) {
  // Match sizes like 3/4", 1", 1-1/4", 1-1/2", 2", 4-11/16"
  const m = text.match(/(\d+(?:-\d+\/\d+)?(?:\/\d+)?)\s*(?:"|inch|in\b)/i);
  return m ? m[1].trim() : "";
}

function parseItemLine(line, materials) {
  const text = line.trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  const inputSize = extractSize(text);

  let best = null;
  let bestScore = 0;
  for (const m of materials) {
    const mName = (m.name || "").toLowerCase();
    const materialSize = extractSize(m.name || "");

    // If both have sizes and they don't match, skip — wrong item
    if (inputSize && materialSize && inputSize !== materialSize) continue;

    const words = lower.split(/\s+/).filter(w => w.length > 1);
    const mWords = mName.split(/\s+/).filter(w => w.length > 1);
    const overlap = words.filter(w => mWords.some(mw => mw.includes(w) || w.includes(mw)));
    const score = overlap.length / Math.max(words.length, mWords.length);
    if (score > bestScore) { bestScore = score; best = m; }
  }

  const matched = bestScore >= 0.6 ? best : null;

  // Category is left blank — user assigns it via the Catalog editor
  const category = "";

  // Extract size
  const sizeMatch = text.match(/(\d+(?:-\d+\/\d+)?(?:\/\d+)?)\s*(?:"|inch|in\b)/i);
  const size = sizeMatch ? sizeMatch[0].trim() : "";

  return {
    original: text,
    name: text,
    category,
    size,
    unit: "each",
    matched_material: matched,
    status: matched ? "existing" : "new", // "existing" | "new" | "skip"
  };
}

export default function BulkItemImport({ lines, materials, onComplete, onCancel }) {
  const parsed = useMemo(() =>
    lines.map(l => parseItemLine(l, materials)).filter(Boolean),
    [lines, materials]
  );

  const [items, setItems] = useState(parsed);
  const [creating, setCreating] = useState(false);

  const toggleStatus = (idx) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      if (item.status === "new") return { ...item, status: "skip" };
      if (item.status === "skip") return { ...item, status: "new" };
      if (item.status === "existing") return { ...item, status: "force_new" };
      if (item.status === "force_new") return { ...item, status: "existing" };
      return item;
    }));
  };

  const handleCreateAll = async () => {
    const toCreate = items.filter(i => i.status === "new" || i.status === "force_new");
    if (toCreate.length === 0) {
      toast.info("No new items to create.");
      return;
    }

    setCreating(true);
    let created = 0;
    let failed = 0;

    for (const item of toCreate) {
      try {
        await base44.entities.Material.create({
          name: item.name,
          category: item.category || "",
          unit: item.unit || "each",
        });
        created++;
      } catch {
        failed++;
      }
    }

    setCreating(false);
    toast.success(`Created ${created} item profile${created !== 1 ? "s" : ""}${failed > 0 ? ` (${failed} failed)` : ""}`);
    onComplete({ created, failed, skipped: items.filter(i => i.status === "skip").length });
  };

  const newCount = items.filter(i => i.status === "new" || i.status === "force_new").length;
  const existingCount = items.filter(i => i.status === "existing").length;
  const skipCount = items.filter(i => i.status === "skip").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Detected <span className="text-primary font-bold">{items.length}</span> items
        </p>
        <div className="flex gap-2 text-xs">
          <Badge className="bg-green-100 text-green-700">{newCount} new</Badge>
          <Badge className="bg-blue-100 text-blue-700">{existingCount} existing</Badge>
          {skipCount > 0 && <Badge className="bg-muted text-muted-foreground">{skipCount} skipped</Badge>}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 transition-colors ${
              item.status === "skip" ? "opacity-40 bg-muted/20" :
              item.status === "force_new" ? "bg-orange-50 border-l-4 border-l-orange-500" :
              "bg-card"
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.original}</p>
              <div className="flex gap-1.5 mt-0.5 flex-wrap">
                {item.category && <span className="text-xs text-muted-foreground">{item.category}</span>}
                {item.matched_material && item.status !== "force_new" && (
                  <span className="text-xs text-blue-600">→ matches "{item.matched_material.name}"</span>
                )}
                {item.status === "force_new" && item.matched_material && (
                  <span className="text-xs text-orange-600">⚠ override: was "{item.matched_material.name}"</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {item.status === "existing" && (
                <Badge className="bg-blue-100 text-blue-700 text-xs gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Exists
                </Badge>
              )}
              {item.status === "new" && (
                <Badge className="bg-green-100 text-green-700 text-xs gap-1">
                  <Package className="w-3 h-3" /> Create
                </Badge>
              )}
              {item.status === "force_new" && (
                <Badge className="bg-orange-100 text-orange-700 text-xs gap-1">
                  <Package className="w-3 h-3" /> Force Create
                </Badge>
              )}
              {item.status === "skip" && (
                <Badge className="bg-muted text-muted-foreground text-xs">Skip</Badge>
              )}
              {(item.status === "new" || item.status === "skip" || item.status === "existing" || item.status === "force_new") && (
                <button
                  onClick={() => toggleStatus(idx)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {item.status === "new" ? "Skip" : item.status === "skip" ? "Undo" : item.status === "existing" ? "Don't Match" : "Keep Match"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Exists</strong> = use existing item · <strong>Create</strong> = new material profile · <strong>Force Create</strong> = create new (override match) · <strong>Skip</strong> = manual review
      </p>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel} disabled={creating}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
          onClick={handleCreateAll}
          disabled={creating || newCount === 0}
        >
          {creating ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Creating...</> : `Create ${newCount} Item${newCount !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}