import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useUserCompanyId } from "@/lib/useUserCompanyId";
import CompanyAccessGate from "@/components/CompanyAccessGate";
import { ScanLine, Loader2, Package, Search, Pencil, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import BarcodeScanner from "../components/scanner/BarcodeScanner";
import SmartInventoryInput from "../components/scanner/SmartInventoryInput";
import LinkBarcodeDialog from "../components/scanner/LinkBarcodeDialog";
import BulkOperationsPanel from "../components/scanner/BulkOperationsPanel";
import QuickActionFlow from "../components/scanner/QuickActionFlow";

export default function Scanner() {
  const { user } = useAuth();
  const { activeCompanyId } = useUserCompanyId();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [scannedMaterial, setScannedMaterial] = useState(null);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [editingProduct, setEditingProduct] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [buildrProjects, setBuildrProjects] = useState([]);
  const [showSmartInput, setShowSmartInput] = useState(false);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [linkCandidates, setLinkCandidates] = useState([]);
  const [pendingProductData, setPendingProductData] = useState(null);

  const queryClient = useQueryClient();

  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.AppSettings.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
    staleTime: 60000,
  });
  const companyLogo = settingsList[0]?.logo_url;

  const { data: locations = [] } = useQuery({
    queryKey: ["locations", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.Location.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.Material.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventoryItems", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.InventoryItem.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  // Pre-select material if navigated from Inventory
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const materialId = params.get("materialId");
    if (materialId && materials.length > 0) {
      const found = materials.find((m) => m.id === materialId);
      if (found) setScannedMaterial(found);
    }
  }, [materials]);

  // Fetch Buildr projects — only when activeCompanyId is known (multi-tenant safe)
  useQuery({
    queryKey: ["buildrProjects", activeCompanyId],
    queryFn: async () => {
      const response = await base44.functions.invoke('getBuildrProjects', { company_id: activeCompanyId || 'co_dayoneelectric' });
      const projects = response.data.projects || [];
      setBuildrProjects(projects);
      return projects;
    },
    enabled: !!activeCompanyId,
  });

  // Normalize a string for comparison: lowercase, remove punctuation/extra spaces
  const normalizeName = (str) =>
  (str || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  // Score how closely two normalized names match (0–1)
  const scoreName = (a, b) => {
    const wordsA = normalizeName(a).split(" ").filter((w) => w.length > 1);
    const wordsB = normalizeName(b).split(" ").filter((w) => w.length > 1);
    if (!wordsA.length || !wordsB.length) return 0;
    const overlap = wordsA.filter((w) => wordsB.includes(w));
    return overlap.length / Math.max(wordsA.length, wordsB.length);
  };

  const findLinkCandidates = (productName) => {
    // Only consider materials with no barcode assigned
    const noBarcodeItems = materials.filter((m) => !m.barcode || m.barcode.trim() === "");
    const normProduct = normalizeName(productName);

    const scored = noBarcodeItems.
    map((m) => ({ ...m, matchScore: scoreName(normProduct, m.name) })).
    filter((m) => m.matchScore >= 0.5) // conservative threshold
    .sort((a, b) => b.matchScore - a.matchScore).
    slice(0, 3); // top 3 candidates max

    return scored;
  };

  const handleScan = async (barcode) => {
    setScannerOpen(false);
    const normalizedBarcode = barcode.trim();
    setScannedBarcode(normalizedBarcode);
    setLookingUp(true);

    // Step 1: Check if material already exists in our database by exact barcode match
    const existing = materials.find((m) => m.barcode && m.barcode.trim() === normalizedBarcode);
    if (existing) {
      setScannedMaterial(existing);
      setLookingUp(false);
      toast.success(`Found: ${existing.name}`);
      return;
    }

    // Use LLM to look up product data from barcode
    let productData;
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Search the internet for the exact product that matches this barcode/UPC: "${normalizedBarcode}".
        
        IMPORTANT RULES:
        - Only return data you are highly confident is correct for THIS specific barcode.
        - Do NOT guess or infer product details. If unsure, leave the field as an empty string.
        - Search barcode databases (barcodelookup.com, upcitemdb.com, open.fda.gov, manufacturer sites).
        - The "name" should be the full product name including brand, model, and size/variant if known.
        - The "manufacturer" should be the brand/company name only.
        - The "part_number" is the manufacturer's SKU or part number if available.
        - If you cannot confidently identify the product, set name to "Unknown Product - ${normalizedBarcode}" and leave all other fields empty.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Full product name including brand and model" },
            description: { type: "string", description: "Product description" },
            manufacturer: { type: "string", description: "Manufacturer or brand name" },
            part_number: { type: "string", description: "Manufacturer part number or SKU" },
            category: { type: "string", description: "Product category (e.g. Electrical, Plumbing, Tools)" },
            unit: { type: "string", description: "Unit of measurement (each, ft, box, roll, etc.)" },
            estimated_price: { type: "number", description: "Estimated unit price in USD, 0 if unknown" },
            confidence: { type: "string", enum: ["high", "medium", "low"], description: "How confident you are this is the right product" }
          }
        },
        model: "gemini_3_flash"
      });

      productData = {
        barcode: normalizedBarcode,
        name: result.name || `Unknown Product - ${normalizedBarcode}`,
        description: result.description || "",
        manufacturer: result.manufacturer || "",
        supplier: result.part_number || "",
        category: result.category || "",
        unit: result.unit || "each",
        unit_cost: result.estimated_price || 0
      };

      if (result.confidence === "low" || !result.name) {
        toast.warning("Product details may be inaccurate — please verify before saving.");
      } else {
        toast.success(`Product found: ${productData.name}`);
      }
    } catch {
      // Network error or lookup failed — let user fill in manually
      productData = {
        barcode: normalizedBarcode,
        name: "",
        description: "",
        manufacturer: "",
        supplier: "",
        category: "",
        unit: "each",
        unit_cost: 0
      };
      toast.warning("Couldn't look up product — please fill in the details manually.");
    }

    // Step 2: Check for existing no-barcode items that may match the scanned product
    const candidates = findLinkCandidates(productData.name);
    if (candidates.length > 0) {
      setPendingProductData(productData);
      setLinkCandidates(candidates);
      setLookingUp(false);
      return;
    }

    // Step 3: No matches — go straight to edit/confirm new item
    setEditFields(productData);
    setEditingProduct(true);
    setLookingUp(false);
  };



  const confirmProduct = async () => {
    let saved;
    if (editFields.id) {
      // Updating an existing material
      await base44.entities.Material.update(editFields.id, editFields);
      saved = editFields;
    } else {
      saved = await base44.entities.Material.create({ ...editFields, company_id: activeCompanyId });
    }
    queryClient.invalidateQueries({ queryKey: ["materials", activeCompanyId] });
    setScannedMaterial(saved);
    setEditingProduct(false);
    toast.success(`Saved: ${saved.name}`);
  };

  const handleLinkBarcode = async (candidate) => {
    // Stamp the scanned barcode onto the selected existing material
    await base44.entities.Material.update(candidate.id, { barcode: scannedBarcode });
    queryClient.invalidateQueries({ queryKey: ["materials", activeCompanyId] });
    const updated = { ...candidate, barcode: scannedBarcode };
    setLinkCandidates([]);
    setPendingProductData(null);
    setScannedMaterial(updated);
    toast.success(`Barcode linked to "${candidate.name}"`);
  };

  const handleLinkCreateNew = () => {
    const data = pendingProductData;
    setLinkCandidates([]);
    setPendingProductData(null);
    setEditFields(data);
    setEditingProduct(true);
  };

  const handleLinkCancel = () => {
    setLinkCandidates([]);
    setPendingProductData(null);
    setScannedBarcode("");
  };

  const resetForm = () => {
    setScannedMaterial(null);
    setScannedBarcode("");
    setEditingProduct(false);
    setEditFields({});
  };

  const scannerContent = (
    <div className="space-y-8 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quick Action</h1>
          <p className="text-muted-foreground mt-1">Search, select, and update inventory in seconds</p>
        </div>
        {companyLogo && (
          <img src={companyLogo} alt="Company Logo" className="h-14 w-auto max-w-[200px] object-contain self-start sm:self-auto" />
        )}
      </div>

      {/* ── PRIMARY: Quick Action Flow ── */}
      {!lookingUp && !editingProduct && !showBulkPanel && !showSmartInput && (
        <div className="space-y-3">
          <QuickActionFlow
            materials={materials}
            locations={locations}
            inventoryItems={inventoryItems}
            buildrProjects={buildrProjects}
            currentUser={user}
            activeCompanyId={activeCompanyId}
            initialMaterial={scannedMaterial}
            onClearInitial={() => setScannedMaterial(null)}
            onComplete={() => {
              setScannedMaterial(null);
              queryClient.invalidateQueries({ queryKey: ["inventoryItems", activeCompanyId] });
              queryClient.invalidateQueries({ queryKey: ["transactions", activeCompanyId] });
              queryClient.invalidateQueries({ queryKey: ["materials", activeCompanyId] });
            }}
          />

          {/* ── Secondary tools row ── */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setScannerOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-secondary/40 hover:border-secondary/70 hover:bg-secondary/5 transition-colors text-secondary text-xs font-medium"
            >
              <ScanLine className="w-3.5 h-3.5" /> Scan Barcode
            </button>
            <button
              onClick={() => setShowSmartInput(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-colors text-primary/70 text-xs font-medium"
            >
              ⚡ Smart Input
            </button>
            <button
              onClick={() => setShowBulkPanel(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 hover:bg-muted/30 transition-colors text-muted-foreground text-xs font-medium"
            >
              📋 Bulk Ops
            </button>
          </div>
        </div>
      )}

      {/* ── Secondary panels ── */}
      {showBulkPanel && (
        <BulkOperationsPanel
          materials={materials}
          locations={locations}
          inventoryItems={inventoryItems}
          buildrProjects={buildrProjects}
          activeCompanyId={activeCompanyId}
          onClose={() => setShowBulkPanel(false)}
          onComplete={({ succeeded, failed }) => {
            queryClient.invalidateQueries({ queryKey: ["inventoryItems", activeCompanyId] });
            queryClient.invalidateQueries({ queryKey: ["transactions", activeCompanyId] });
            toast.success(`Bulk complete: ${succeeded} succeeded${failed > 0 ? `, ${failed} failed` : ""}`);
          }}
        />
      )}

      {showSmartInput && (
        <SmartInventoryInput
          materials={materials}
          locations={locations}
          inventoryItems={inventoryItems}
          buildrProjects={buildrProjects}
          activeCompanyId={activeCompanyId}
          onCommit={({ type, material }) => {
            if (type !== "find") {
              queryClient.invalidateQueries({ queryKey: ["inventoryItems", activeCompanyId] });
              queryClient.invalidateQueries({ queryKey: ["transactions", activeCompanyId] });
              queryClient.invalidateQueries({ queryKey: ["materials", activeCompanyId] });
            }
            if (material && type === "find") setScannedMaterial(material);
            setShowSmartInput(false);
          }}
          onClose={() => setShowSmartInput(false)}
        />
      )}

      {/* Loading State */}
      {lookingUp &&
      <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 text-secondary animate-spin mb-4" />
            <h3 className="text-lg font-semibold">Looking up product...</h3>
            <p className="text-sm text-muted-foreground mt-1">Barcode: {scannedBarcode}</p>
          </CardContent>
        </Card>
      }

      {/* Product Confirmation / Edit Step */}
      {editingProduct && !scannedMaterial &&
      <Card className="border-2 border-secondary/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="w-5 h-5 text-secondary" />
              Verify Product Details
              <span className="ml-auto text-xs font-normal text-muted-foreground">Edit if anything is wrong</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Product Name *</Label>
                <Input value={editFields.name || ""} onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Manufacturer / Brand</Label>
                  <Input value={editFields.manufacturer || ""} onChange={(e) => setEditFields((f) => ({ ...f, manufacturer: e.target.value }))} placeholder="e.g. Milwaukee" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Part Number / SKU</Label>
                  <Input value={editFields.supplier || ""} onChange={(e) => setEditFields((f) => ({ ...f, supplier: e.target.value }))} placeholder="e.g. 48-22-0050" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Input value={editFields.category || ""} onChange={(e) => setEditFields((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Electrical" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unit</Label>
                  <Input value={editFields.unit || "each"} onChange={(e) => setEditFields((f) => ({ ...f, unit: e.target.value }))} placeholder="each / ft / box" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={editFields.description || ""} onChange={(e) => setEditFields((f) => ({ ...f, description: e.target.value }))} placeholder="Optional product description" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit Cost ($)</Label>
                <Input type="number" value={editFields.unit_cost || ""} onChange={(e) => setEditFields((f) => ({ ...f, unit_cost: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-mono">Barcode: {editFields.barcode}</p>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={resetForm}>Cancel</Button>
              <Button className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={confirmProduct}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirm & Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      }



      <LinkBarcodeDialog
        open={linkCandidates.length > 0}
        barcode={scannedBarcode}
        candidates={linkCandidates}
        onLink={handleLinkBarcode}
        onCreateNew={handleLinkCreateNew}
        onCancel={handleLinkCancel} />
      

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </div>
  );

  if (!user) return null;

  return (
    <CompanyAccessGate userEmail={user.email}>
      {scannerContent}
    </CompanyAccessGate>
  );
}