import React, { useState, useRef, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  Search, Mic, MicOff, Plus, ArrowLeftRight, Minus,
  CheckCircle2, X, Package, Loader2, Clock, SlidersHorizontal, TrendingDown
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { searchMaterials, parseIntent } from "@/utils/searchMaterials";
import ProjectPicker, { markProjectUsed } from "./ProjectPicker";
import { enqueueAction } from "@/lib/offlineQueue";

// ─── Constants ────────────────────────────────────────────────────────────────
const LS_RECENT_KEY = "stockr_recent_materials";
const LS_TO_LOC_KEY = "stockr_last_to_loc";
const LS_FROM_LOC_KEY = "stockr_last_from_loc";
const MAX_RECENT = 20;

function loadLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── LocationPicker ────────────────────────────────────────────────────────────
function LocationPicker({ locations, value, onChange, placeholder, showQty, materialId, inventoryItems }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selected = locations.find(l => l.id === value);
  const filtered = query
    ? locations.filter(l => l.name.toLowerCase().includes(query.toLowerCase()))
    : locations;

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getQty = (locId) => {
    if (!showQty || !materialId || !inventoryItems) return null;
    return inventoryItems.find(i => i.material_id === materialId && i.location_id === locId)?.quantity || 0;
  };

  return (
    <div ref={ref} className="relative">
      <div
        className="flex h-9 w-full items-center rounded-lg border border-input bg-transparent px-3 text-sm cursor-pointer gap-2 hover:border-primary/50 transition-colors"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
      >
        {selected ? (
          <span className="flex-1 truncate">{selected.type === "warehouse" ? "🏭" : "🚛"} {selected.name}</span>
        ) : (
          <span className="flex-1 text-muted-foreground">{placeholder}</span>
        )}
        {selected && (
          <button onClick={e => { e.stopPropagation(); onChange(""); }} className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-lg shadow-lg overflow-hidden">
          <input
            ref={inputRef}
            className="w-full px-3 py-2 text-sm border-b bg-transparent outline-none"
            placeholder="Type to filter..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="max-h-72 overflow-y-auto">
            {filtered.map(l => {
              const qty = getQty(l.id);
              return (
                <button
                  key={l.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between"
                  onClick={() => { onChange(l.id); setOpen(false); setQuery(""); }}
                >
                  <span>{l.type === "warehouse" ? "🏭" : "🚛"} {l.name}</span>
                  {qty !== null && <span className={`text-xs ${qty > 0 ? "text-green-600" : "text-muted-foreground"}`}>{qty}</span>}
                </button>
              );
            })}
            {filtered.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No locations found</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main QuickActionFlow ──────────────────────────────────────────────────────
export default function QuickActionFlow({ materials, locations, inventoryItems, buildrProjects, currentUser, activeCompanyId, onComplete, initialMaterial, onClearInitial }) {
  const [query, setQuery] = useState(initialMaterial ? initialMaterial.name : "");
  const [results, setResults] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [selectedMaterial, setSelectedMaterial] = useState(initialMaterial || null);
  const [action, setAction] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [toLocationId, setToLocationId] = useState("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [buildrProjectId, setBuildrProjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [listening, setListening] = useState(false);
  const [recentIds, setRecentIds] = useState(() => loadLS(LS_RECENT_KEY, []));
  const [showRecent, setShowRecent] = useState(false);
  const [parsedIntent, setParsedIntent] = useState(null);
  const [notes, setNotes] = useState("");

  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceSupported = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;

  // ── Sync recent IDs from user profile if available ──
  useEffect(() => {
    if (currentUser?.recent_material_ids?.length > 0) {
      setRecentIds(currentUser.recent_material_ids);
    }
  }, [currentUser]);

  // ── When barcode scan delivers a material, inject it ──
  useEffect(() => {
    if (initialMaterial) {
      setSelectedMaterial(initialMaterial);
      setQuery(initialMaterial.name);
      setAction(null);
      setDropdownOpen(false);
    }
  }, [initialMaterial?.id]);

  // ── Prefill last-used locations when action changes ──
  useEffect(() => {
    if (!action) return;
    const lastTo = loadLS(LS_TO_LOC_KEY, "");
    const lastFrom = loadLS(LS_FROM_LOC_KEY, "");
    if ((action === "add" || action === "transfer") && !toLocationId && lastTo) setToLocationId(lastTo);
    if ((action === "transfer" || action === "use") && !fromLocationId && lastFrom) setFromLocationId(lastFrom);
  }, [action]);

  // ── Live search ──
  useEffect(() => {
    const intent = parseIntent(query);
    setParsedIntent(intent);
    const searchQuery = intent.itemQuery || query;
    const matches = searchMaterials(searchQuery, materials, { recentIds, limit: 10 });
    setResults(matches);
    setHighlightIdx(0);
  }, [query, materials, recentIds]);

  // ── Close dropdown on outside click ──
  useEffect(() => {
    const handler = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Keyboard navigation ──
  const handleKeyDown = useCallback(e => {
    if (!dropdownOpen) { if (e.key === "ArrowDown") setDropdownOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[highlightIdx]) selectMaterial(results[highlightIdx]); }
    else if (e.key === "Escape") { setDropdownOpen(false); }
  }, [dropdownOpen, results, highlightIdx]);

  const selectMaterial = (mat) => {
    setSelectedMaterial(mat);
    setDropdownOpen(false);

    // Apply parsed intent if available
    const intent = parseIntent(query);
    if (intent.action) setAction(intent.action);
    if (intent.quantity) setQuantity(intent.quantity);
    if (intent.projectName) setProjectName(intent.projectName);

    // Try to match intent locations
    if (intent.toLocationName) {
      const loc = locations.find(l => l.name.toLowerCase().includes(intent.toLocationName.toLowerCase()));
      if (loc) setToLocationId(loc.id);
    }
    if (intent.fromLocationName) {
      const loc = locations.find(l => l.name.toLowerCase().includes(intent.fromLocationName.toLowerCase()));
      if (loc) setFromLocationId(loc.id);
    }

    // Show action buttons if no action inferred yet
    setQuery(mat.name);
  };

  const saveRecent = (materialId) => {
    const updated = [materialId, ...recentIds.filter(id => id !== materialId)].slice(0, MAX_RECENT);
    setRecentIds(updated);
    saveLS(LS_RECENT_KEY, updated);
    // Persist to user profile if logged in
    if (currentUser) {
      base44.auth.updateMe({ recent_material_ids: updated }).catch(() => {});
    }
  };

  const handleSubmit = async () => {
    if (!selectedMaterial || !action) return;
    if (action === "add" && !toLocationId) { toast.error("Select a destination"); return; }
    if (action === "transfer" && (!fromLocationId || !toLocationId)) { toast.error("Select source and destination"); return; }
    if (action === "use" && !fromLocationId) { toast.error("Select source location"); return; }
    if ((action === "adjust" || action === "shrink") && !fromLocationId) { toast.error("Select source location"); return; }
    if (!activeCompanyId) { toast.error("Company context missing — cannot proceed"); return; }

    setSubmitting(true);

    const payload = {
      actionType: action,
      materialId: selectedMaterial.id,
      quantity,
      fromLocationId: fromLocationId || null,
      toLocationId: toLocationId || null,
      projectName: projectName || null,
      buildrProjectId: buildrProjectId || null,
      notes: notes || null,
      company_id: activeCompanyId,
    };

    // Offline: queue and complete optimistically — will sync on reconnect
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueAction(payload);
      if (toLocationId) saveLS(LS_TO_LOC_KEY, toLocationId);
      if (fromLocationId) saveLS(LS_FROM_LOC_KEY, fromLocationId);
      if (buildrProjectId) markProjectUsed(buildrProjectId);
      saveRecent(selectedMaterial.id);
      const labels = { add: "Added", transfer: "Transferred", use: "Used", adjust: "Adjusted", shrink: "Shrinkage" };
      toast.success(`${labels[action]} ${quantity} × ${selectedMaterial.name} (offline — will sync)`);
      onComplete();
      resetFlow();
      setSubmitting(false);
      return;
    }

    try {
      const response = await base44.functions.invoke("processInventoryAction", payload);

      if (response.data?.error) {
        toast.error(response.data.error.message || "Action failed");
        return;
      }

      // Save last-used locations
      if (toLocationId) saveLS(LS_TO_LOC_KEY, toLocationId);
      if (fromLocationId) saveLS(LS_FROM_LOC_KEY, fromLocationId);
      if (buildrProjectId) markProjectUsed(buildrProjectId);
      saveRecent(selectedMaterial.id);

      // Update user profile last-used locations
      if (currentUser) {
        base44.auth.updateMe({
          last_to_location_id: toLocationId || currentUser.last_to_location_id,
          last_from_location_id: fromLocationId || currentUser.last_from_location_id,
        }).catch(() => {});
      }

      const labels = { add: "Added", transfer: "Transferred", use: "Used", adjust: "Adjusted", shrink: "Shrinkage" };
      toast.success(`${labels[action]} ${quantity} × ${selectedMaterial.name}`);
      onComplete();
      resetFlow();
    } catch (err) {
      // Network failure while nominally online — queue for retry
      const looksNetworky = !navigator.onLine || /fetch|network|Failed to/i.test(err?.message || "");
      if (looksNetworky) {
        enqueueAction(payload);
        if (toLocationId) saveLS(LS_TO_LOC_KEY, toLocationId);
        if (fromLocationId) saveLS(LS_FROM_LOC_KEY, fromLocationId);
        if (buildrProjectId) markProjectUsed(buildrProjectId);
        saveRecent(selectedMaterial.id);
        toast.success(`Saved offline — will sync when connected`);
        onComplete();
        resetFlow();
      } else {
        toast.error(err?.message || "Unexpected error — please try again");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetFlow = () => {
    setQuery("");
    setSelectedMaterial(null);
    setAction(null);
    setQuantity(1);
    setToLocationId("");
    setFromLocationId("");
    setProjectName("");
    setBuildrProjectId("");
    setDropdownOpen(false);
    setParsedIntent(null);
    setNotes("");
    if (onClearInitial) onClearInitial();
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ── Voice input ──
  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); toast.error("Voice not recognized, try again"); };
    recognition.onresult = e => {
      const transcript = e.results[0][0].transcript;
      setListening(false);
      setQuery(transcript);
      setDropdownOpen(true);
      toast.success(`Heard: "${transcript}"`);
      // Auto-select top result after brief delay (give search time to run)
      setTimeout(() => {
        const intent = parseIntent(transcript);
        const searchQ = intent.itemQuery || transcript;
        const matches = searchMaterials(searchQ, materials, { recentIds, limit: 10 });
        if (matches.length > 0) selectMaterial(matches[0]);
      }, 100);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [materials, recentIds]);

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  // ── Recent items for empty-state dropdown ──
  const recentMaterials = recentIds
    .map(id => materials.find(m => m.id === id))
    .filter(Boolean)
    .slice(0, 5);

  const showDropdownResults = dropdownOpen && !selectedMaterial && query.trim().length > 0;
  const displayResults = results;

  return (
    <div className="space-y-3">
      {/* ── Search Bar ── */}
      <div ref={dropdownRef} className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
            <input
              ref={inputRef}
              autoFocus
              autoComplete="off"
              className="flex h-12 w-full rounded-xl border-2 border-input bg-background px-3 pl-9 text-base shadow-sm transition-colors focus:border-primary focus:outline-none"
              placeholder="Search materials or type an action (e.g. add 10 pvc couplings)..."
              value={query}
              onChange={e => { setQuery(e.target.value); setDropdownOpen(true); if (selectedMaterial && e.target.value !== selectedMaterial.name) { setSelectedMaterial(null); setAction(null); } }}
              onKeyDown={handleKeyDown}
            />
            {query && (
              <button type="button" onClick={resetFlow} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {voiceSupported && (
            <button
              type="button"
              onClick={listening ? stopVoice : startVoice}
              className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                listening ? "bg-red-500 border-red-500 text-white animate-pulse" : "bg-background border-input text-muted-foreground hover:border-primary hover:text-primary"
              }`}
              title={listening ? "Stop listening" : "Voice input"}
            >
              {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
        </div>

        {/* ── Dropdown ── */}
        {showDropdownResults && (
          <div className="absolute z-50 mt-1 w-full bg-popover border rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
            {displayResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">No matches — try a different term</div>
            ) : (
              displayResults.map((mat, idx) => {
                const totalQty = inventoryItems.filter(i => i.material_id === mat.id).reduce((s, i) => s + (i.quantity || 0), 0);
                return (
                  <button
                    key={mat.id}
                    type="button"
                    className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors border-b last:border-b-0 ${highlightIdx === idx ? "bg-primary/8 border-l-2 border-l-primary" : "hover:bg-muted/60"}`}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onClick={() => selectMaterial(mat)}
                  >
                    <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{mat.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[mat.manufacturer, mat.category, mat.sub_category].filter(Boolean).join(" · ")}
                        {mat.barcode ? ` · ${mat.barcode}` : ""}
                      </p>
                    </div>
                    {totalQty > 0 && (
                      <span className="text-xs font-bold text-primary flex-shrink-0 bg-primary/10 px-2 py-0.5 rounded-full">{totalQty}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Action buttons (always visible) ── */}
      {!action && (
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => setAction("add")}
            className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 text-green-700 transition-all active:scale-95">
            <Plus className="w-5 h-5" />
            <span className="text-sm font-bold">Add</span>
          </button>
          <button type="button" onClick={() => setAction("transfer")}
            className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-all active:scale-95">
            <ArrowLeftRight className="w-5 h-5" />
            <span className="text-sm font-bold">Transfer</span>
          </button>
          <button type="button" onClick={() => setAction("use")}
            className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 transition-all active:scale-95">
            <Minus className="w-5 h-5" />
            <span className="text-sm font-bold">Use</span>
          </button>
          <button type="button" onClick={() => setAction("adjust")}
            className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 border-yellow-200 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 transition-all active:scale-95">
            <SlidersHorizontal className="w-5 h-5" />
            <span className="text-sm font-bold">Adjust</span>
          </button>
          <button type="button" onClick={() => setAction("shrink")}
            className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition-all active:scale-95">
            <TrendingDown className="w-5 h-5" />
            <span className="text-sm font-bold">Shrink</span>
          </button>
        </div>
      )}

      {/* ── Recent items (optional accelerator) ── */}
      {!selectedMaterial && !query.trim() && recentMaterials.length > 0 && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setShowRecent(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-1 transition-colors"
          >
            <Clock className="w-3 h-3" />
            Recent {showRecent ? "▲" : "▼"}
          </button>
          {showRecent && <div className="space-y-1">
            {recentMaterials.map((mat, idx) => {
              const totalQty = inventoryItems.filter(i => i.material_id === mat.id).reduce((s, i) => s + (i.quantity || 0), 0);
              return (
                <button
                  key={mat.id}
                  type="button"
                  className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border border-muted hover:bg-muted/60 transition-colors"
                  onClick={() => selectMaterial(mat)}
                >
                  <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{mat.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[mat.manufacturer, mat.category].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {totalQty > 0 && (
                    <span className="text-xs font-bold text-primary flex-shrink-0 bg-primary/10 px-2 py-0.5 rounded-full">{totalQty}</span>
                  )}
                </button>
              );
            })}
          </div>}
        </div>
      )}

      {/* ── Intent banner (when action/qty parsed from text) ── */}
      {!selectedMaterial && parsedIntent?.action && query.trim() && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
          <span>Detected intent:</span>
          {parsedIntent.action && <span className="font-semibold capitalize">{parsedIntent.action}</span>}
          {parsedIntent.quantity && <span>× {parsedIntent.quantity}</span>}
          {parsedIntent.toLocationName && <span>→ {parsedIntent.toLocationName}</span>}
        </div>
      )}

      {/* ── Selected material + action flow ── */}
      {selectedMaterial && (
        <div className="space-y-2">
          {/* Material chip */}
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
            <Package className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{selectedMaterial.name}</p>
              {selectedMaterial.manufacturer && <p className="text-xs text-muted-foreground">{selectedMaterial.manufacturer}</p>}
            </div>
            <button type="button" onClick={resetFlow} className="text-muted-foreground hover:text-foreground flex-shrink-0 ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Compact action form */}
          {action && (
            <div className="border-2 rounded-xl">
              {/* Action header */}
              <div className={`flex items-center justify-between px-3 py-2 ${
                action === "add" ? "bg-green-50 border-b border-green-100" :
                action === "transfer" ? "bg-blue-50 border-b border-blue-100" :
                action === "adjust" ? "bg-yellow-50 border-b border-yellow-100" :
                action === "shrink" ? "bg-red-50 border-b border-red-100" :
                "bg-orange-50 border-b border-orange-100"
              }`}>
                <div className="flex items-center gap-2">
                  {action === "add" && <Plus className="w-4 h-4 text-green-600" />}
                  {action === "transfer" && <ArrowLeftRight className="w-4 h-4 text-blue-600" />}
                  {action === "use" && <Minus className="w-4 h-4 text-orange-600" />}
                  {action === "adjust" && <SlidersHorizontal className="w-4 h-4 text-yellow-600" />}
                  {action === "shrink" && <TrendingDown className="w-4 h-4 text-red-600" />}
                  <span className={`text-sm font-bold capitalize ${
                    action === "add" ? "text-green-700" : action === "transfer" ? "text-blue-700" : action === "adjust" ? "text-yellow-700" : action === "shrink" ? "text-red-700" : "text-orange-700"
                  }`}>{action}</span>
                </div>
                <button type="button" onClick={() => setAction(null)} className="text-xs text-muted-foreground hover:text-foreground underline">change</button>
              </div>

              {/* Fields */}
              <div className="p-3 space-y-2 bg-background">
                {/* Quantity — always */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-14 flex-shrink-0">Qty</span>
                  <div className="flex items-center gap-1">
                    <button type="button" className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted font-bold text-base" onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
                    <input
                      type="number" min="1"
                      value={quantity}
                      onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-14 h-7 text-center text-sm border rounded-lg bg-transparent font-semibold"
                    />
                    <button type="button" className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted font-bold text-base" onClick={() => setQuantity(q => q + 1)}>＋</button>
                  </div>
                </div>

                {/* To location */}
                {(action === "add" || action === "transfer") && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-14 flex-shrink-0">To</span>
                    <div className="flex-1">
                      <LocationPicker locations={locations} value={toLocationId} onChange={setToLocationId} placeholder="Select destination…" />
                    </div>
                  </div>
                )}

                {/* From location */}
                {(action === "transfer" || action === "use" || action === "adjust" || action === "shrink") && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-14 flex-shrink-0">From</span>
                    <div className="flex-1">
                      <LocationPicker
                        locations={locations}
                        value={fromLocationId}
                        onChange={setFromLocationId}
                        placeholder="Select source…"
                        showQty
                        materialId={selectedMaterial.id}
                        inventoryItems={inventoryItems}
                      />
                    </div>
                  </div>
                )}

                {/* Project — use only */}
                {action === "use" && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-14 flex-shrink-0">Project</span>
                    <div className="flex-1">
                      {buildrProjects?.length > 0 ? (
                        <ProjectPicker
                          projects={buildrProjects}
                          value={buildrProjectId}
                          onChange={v => {
                            const proj = buildrProjects.find(p => p.id === v);
                            setBuildrProjectId(v);
                            setProjectName(proj?.name || "");
                          }}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">No Buildr projects available</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes — adjust/shrink only */}
                {(action === "adjust" || action === "shrink") && (
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-muted-foreground w-14 flex-shrink-0 pt-2">Notes</span>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder={action === "shrink" ? "Reason for loss (damaged, lost, stolen)..." : "Reason for adjustment..."}
                      className="flex-1 min-h-[60px] text-sm border rounded-lg bg-transparent px-2 py-1.5 outline-none focus:border-primary resize-none"
                    />
                  </div>
                )}

                {/* Confirm */}
                <Button
                  className="w-full h-11 mt-1 bg-secondary text-secondary-foreground hover:bg-secondary/90 text-base font-bold"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
                    : <><CheckCircle2 className="w-4 h-4 mr-2" />Confirm</>
                  }
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}