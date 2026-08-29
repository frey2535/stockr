import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Zap, CheckCircle2, AlertTriangle, X, Package, ArrowLeftRight, Minus, Plus, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { parseSmartInput } from "@/utils/parseSmartInput";
import BulkItemImport from "./BulkItemImport";

const ACTION_ICONS = {
  add: <Plus className="w-4 h-4" />,
  transfer: <ArrowLeftRight className="w-4 h-4" />,
  use: <Minus className="w-4 h-4" />,
  find: <Search className="w-4 h-4" />,
};

const ACTION_LABELS = { add: "Add", transfer: "Transfer", use: "Use", find: "Find" };

const CONFIDENCE_TIER = (c) => {
  if (c >= 0.75) return "high";
  if (c >= 0.45) return "medium";
  return "low";
};

export default function SmartInventoryInput({
  materials,
  locations,
  inventoryItems,
  buildrProjects,
  activeCompanyId,
  onCommit,
  onClose,
}) {
  const [inputText, setInputText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const [editedResult, setEditedResult] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [bulkLines, setBulkLines] = useState(null);
  const textareaRef = useRef(null);

  const getAvailableQty = (materialId, locationId) => {
    const item = inventoryItems.find(i => i.material_id === materialId && i.location_id === locationId);
    return item?.quantity || 0;
  };

  const handleProcess = async () => {
    const text = inputText.trim();
    if (!text) return;

    // Detect multi-line list (2+ non-empty lines)
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      setBulkLines(lines);
      return;
    }

    setParsing(true);
    setParsedResult(null);

    const ruleResult = parseSmartInput(text, { materials, locations });

    if (!ruleResult.needs_llm) {
      setParsedResult(ruleResult);
      setEditedResult({ ...ruleResult });
      setMaterialSearch("");
      setShowMaterialPicker(false);
      setParsing(false);
      return;
    }

    // LLM fallback — only when rule-based is not confident
    try {
      const locationNames = locations.map(l => l.name).join(", ");
      const materialNames = materials.slice(0, 40).map(m => m.name).join(", ");

      const llmResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a general inventory management assistant. Parse this inventory action phrase into structured JSON.

Phrase: "${text}"

Known locations: ${locationNames || "none"}
Known materials (sample): ${materialNames || "none"}

Extract:
- action_type: one of "add", "transfer", "use", "find"
- quantity: number (default 1)
- unit: "each" unless explicitly stated (case, box, roll, ft, lb, etc.)
- material_description: the item being acted on
- normalized_item_name: clean item name including size or variant if mentioned
- size: extracted size or spec if present (e.g. "3/4\"", "10mm", "2x4")
- category: infer a broad category from context if obvious, otherwise leave blank
- from_location_name: source location name if mentioned, or ""
- to_location_name: destination location name if mentioned, or ""
- project: project name if mentioned, or ""
- confidence: 0.0 to 1.0`,
        response_json_schema: {
          type: "object",
          properties: {
            action_type: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            material_description: { type: "string" },
            normalized_item_name: { type: "string" },
            size: { type: "string" },
            category: { type: "string" },
            from_location_name: { type: "string" },
            to_location_name: { type: "string" },
            project: { type: "string" },
            confidence: { type: "number" },
          },
        },
      });

      // Resolve location names to objects
      const fromLoc = locations.find(l => l.name.toLowerCase() === (llmResult.from_location_name || "").toLowerCase()) || null;
      const toLoc = locations.find(l => l.name.toLowerCase() === (llmResult.to_location_name || "").toLowerCase()) || null;

      // Fuzzy match material
      const { match, score } = (() => {
        const desc = (llmResult.normalized_item_name || llmResult.material_description || "").toLowerCase();
        let best = null; let bestScore = 0;
        for (const m of materials) {
          const words = desc.split(/\s+/);
          const mWords = m.name.toLowerCase().split(/\s+/);
          const overlap = words.filter(w => w.length > 2 && mWords.some(mw => mw.includes(w) || w.includes(mw)));
          const sc = overlap.length / Math.max(words.length, mWords.length);
          if (sc > bestScore) { bestScore = sc; best = m; }
        }
        return { match: bestScore > 0.3 ? best : null, score: bestScore };
      })();

      const merged = {
        ...ruleResult,
        ...llmResult,
        from_location: fromLoc,
        to_location: toLoc,
        matched_material: match,
        material_match_score: score,
        raw_text: text,
        needs_llm: false,
      };
      setParsedResult(merged);
      setEditedResult({ ...merged });
      setMaterialSearch("");
      setShowMaterialPicker(false);
    } catch {
      // LLM failed — fall back to rule result and force low confidence review
      const fallback = { ...ruleResult, confidence: Math.min(ruleResult.confidence, 0.3) };
      setParsedResult(fallback);
      setEditedResult({ ...fallback });
      toast.warning("AI parse failed — please review manually.");
    }
    setParsing(false);
  };

  const handleCommit = async () => {
    const r = editedResult;
    if (!r) return;

    if (!activeCompanyId) { toast.error("Company context missing — cannot proceed"); return; }

    if (r.action_type === "find") {
      // For find: just surface the matched material
      if (r.matched_material) {
        toast.success(`Found: ${r.matched_material.name}`);
        onCommit({ type: "find", material: r.matched_material });
      } else {
        toast.info(`No match found for: ${r.material_description}`);
      }
      resetState();
      return;
    }

    setCommitting(true);

    let material = r.matched_material;

    // Create material if needed
    if (!material && r.material_description) {
      material = await base44.entities.Material.create({
        name: r.normalized_item_name || r.material_description,
        description: r.material_description,
        category: r.category || "",
        unit: r.unit || "each",
      });
    }

    if (!material) {
      toast.error("Could not identify or create material.");
      setCommitting(false);
      return;
    }

    // Client-side pre-flight (UX speed)
    if (r.action_type === "add" && !r.to_location?.id) { toast.error("Destination location required."); setCommitting(false); return; }
    if (r.action_type === "transfer" && (!r.from_location?.id || !r.to_location?.id)) { toast.error("Both source and destination required."); setCommitting(false); return; }
    if (r.action_type === "use" && !r.from_location?.id) { toast.error("Source location required."); setCommitting(false); return; }

    const traceMsg = `TRACE: SmartInventoryInput handleCommit fired | material=${material.id} | action=${r.action_type} | company=${activeCompanyId} | time=${new Date().toISOString()}`;
    toast.info(traceMsg);
    const response = await base44.functions.invoke('processInventoryAction', {
      actionType: r.action_type,
      materialId: material.id,
      quantity: r.quantity,
      fromLocationId: r.from_location?.id || null,
      toLocationId: r.to_location?.id || null,
      projectName: r.project_name || null,
      buildrProjectId: r.buildr_project_id || null,
      company_id: activeCompanyId,
    });

    if (response.data?.error) {
      toast.error(response.data.error.message || "Action failed");
      setCommitting(false);
      return;
    }

    const labels = { add: "Added", transfer: "Transferred", use: "Used" };
    toast.success(`${labels[r.action_type]} ${r.quantity} ${material.name}${r.project ? ` on ${r.project}` : ""}`);
    onCommit({ type: r.action_type, material });
    resetState();
    setCommitting(false);
  };

  const resetState = () => {
    setInputText("");
    setParsedResult(null);
    setEditedResult(null);
    setMaterialSearch("");
    setShowMaterialPicker(false);
    setBulkLines(null);
  };

  // Top fuzzy matches for material picker
  const getMaterialMatches = (searchText) => {
    if (!searchText.trim()) return materials.slice(0, 8);
    const q = searchText.toLowerCase();
    return materials
      .map(m => {
        const name = m.name.toLowerCase();
        const words = q.split(/\s+/).filter(w => w.length > 1);
        const nameWords = name.split(/\s+/);
        const overlap = words.filter(w => nameWords.some(nw => nw.includes(w) || w.includes(nw)));
        const score = overlap.length / Math.max(words.length, nameWords.length);
        return { ...m, _score: score };
      })
      .filter(m => m._score > 0 || m.name.toLowerCase().includes(q))
      .sort((a, b) => b._score - a._score)
      .slice(0, 8);
  };

  const tier = editedResult ? CONFIDENCE_TIER(editedResult.confidence) : null;

  return (
    <Card className="border-2 border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Smart Add / Find / Transfer / Use
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <p className="text-xs text-muted-foreground">Type an inventory action in plain English</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Bulk Import Mode */}
        {bulkLines && (
          <BulkItemImport
            lines={bulkLines}
            materials={materials}
            onComplete={({ created }) => {
              resetState();
              onCommit({ type: "bulk_create", created });
            }}
            onCancel={() => setBulkLines(null)}
          />
        )}

        {/* Input */}
        {!bulkLines && <div className="space-y-3">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            className="flex-1 min-h-[72px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleProcess(); }}
            placeholder={'e.g. "add 25 boxes of screws to Main Warehouse"\nor "transfer 10 units from Truck 2 to Shop"'}
          />
        </div>
        <Button
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={!inputText.trim() || parsing}
          onClick={handleProcess}
        >
          {parsing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Parsing...</> : "Process"}
        </Button>
        </div>}

        {/* Parsed Result Panel */}
        {editedResult && (
          <div className="space-y-3 pt-2 border-t">
            {/* Confidence badge */}
            <div className="flex items-center gap-2">
              {tier === "high" && <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle2 className="w-3 h-3" />High Confidence</Badge>}
              {tier === "medium" && <Badge className="bg-yellow-100 text-yellow-700 gap-1"><AlertTriangle className="w-3 h-3" />Review</Badge>}
              {tier === "low" && <Badge className="bg-red-100 text-red-700 gap-1"><AlertTriangle className="w-3 h-3" />Low Confidence — Edit fields</Badge>}
              <span className="text-xs text-muted-foreground ml-auto">
                {ACTION_ICONS[editedResult.action_type]}
              </span>
            </div>

            {/* Action */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Action</Label>
                <Select value={editedResult.action_type} onValueChange={v => setEditedResult(r => ({ ...r, action_type: v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["add","transfer","use","find"].map(a => <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quantity</Label>
                <Input
                  type="number" min="1" className="h-8 text-xs"
                  value={editedResult.quantity}
                  onChange={e => setEditedResult(r => ({ ...r, quantity: parseFloat(e.target.value) || 1 }))}
                />
              </div>
            </div>

            {/* Material Picker */}
            <div className="space-y-1">
              <Label className="text-xs">Item</Label>

              {/* Selected material display */}
              {editedResult.matched_material && !showMaterialPicker ? (
                <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2">
                  <Package className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-800 truncate">{editedResult.matched_material.name}</p>
                    {editedResult.matched_material.manufacturer && (
                      <p className="text-xs text-green-600 truncate">{editedResult.matched_material.manufacturer}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowMaterialPicker(true); setMaterialSearch(editedResult.matched_material.name); }}
                    className="text-xs text-green-700 underline hover:text-green-900 flex-shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      className="h-8 text-xs pl-7"
                      placeholder="Search materials..."
                      value={materialSearch || editedResult.normalized_item_name || editedResult.material_description || ""}
                      onChange={e => {
                        setMaterialSearch(e.target.value);
                        setShowMaterialPicker(true);
                        setEditedResult(r => ({ ...r, normalized_item_name: e.target.value, material_description: e.target.value }));
                      }}
                      onFocus={() => setShowMaterialPicker(true)}
                      autoComplete="off"
                    />
                  </div>
                  {showMaterialPicker && (
                    <div className="border rounded-lg overflow-hidden shadow-sm bg-card">
                      {getMaterialMatches(materialSearch || editedResult.normalized_item_name || "").map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setEditedResult(r => ({ ...r, matched_material: m, normalized_item_name: m.name, material_description: m.name }));
                            setMaterialSearch("");
                            setShowMaterialPicker(false);
                          }}
                          className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-muted/60 transition-colors border-b last:border-b-0"
                        >
                          <Package className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{m.name}</p>
                            {(m.manufacturer || m.category) && (
                              <p className="text-xs text-muted-foreground truncate">{[m.manufacturer, m.category].filter(Boolean).join(" · ")}</p>
                            )}
                          </div>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setEditedResult(r => ({ ...r, matched_material: null }));
                          setShowMaterialPicker(false);
                        }}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-orange-50 transition-colors text-orange-600 border-t"
                      >
                        <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="text-xs font-medium">Create new item</span>
                      </button>
                    </div>
                  )}
                  {!editedResult.matched_material && (
                    <p className="text-xs text-orange-500">No match selected — will create new item on confirm</p>
                  )}
                </div>
              )}
            </div>

            {/* Locations */}
            {(editedResult.action_type === "add" || editedResult.action_type === "transfer") && (
              <div className="space-y-1">
                <Label className="text-xs">{editedResult.action_type === "add" ? "Destination" : "To"}</Label>
                <Select
                  value={editedResult.to_location?.id || ""}
                  onValueChange={v => setEditedResult(r => ({ ...r, to_location: locations.find(l => l.id === v) || null }))}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select location..." /></SelectTrigger>
                  <SelectContent>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.type === "warehouse" ? "🏭" : "🚛"} {l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(editedResult.action_type === "transfer" || editedResult.action_type === "use") && (
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Select
                  value={editedResult.from_location?.id || ""}
                  onValueChange={v => setEditedResult(r => ({ ...r, from_location: locations.find(l => l.id === v) || null }))}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select source..." /></SelectTrigger>
                  <SelectContent>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.type === "warehouse" ? "🏭" : "🚛"} {l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editedResult.action_type === "use" && (
              <div className="space-y-1">
                <Label className="text-xs">Project</Label>
                {buildrProjects?.length > 0 ? (
                  <Select
                    value={editedResult.buildr_project_id || ""}
                    onValueChange={v => {
                      const proj = buildrProjects.find(p => p.id === v);
                      setEditedResult(r => ({ ...r, buildr_project_id: v, project_name: proj?.name || "" }));
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {buildrProjects.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.project_number} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-8 text-xs text-muted-foreground"
                    disabled
                    placeholder="No Buildr projects available"
                  />
                )}
              </div>
            )}

            {/* Commit / Clear */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={resetState}>Clear</Button>
              <Button
                size="sm"
                className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
                disabled={committing}
                onClick={handleCommit}
              >
                {committing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                Confirm
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}