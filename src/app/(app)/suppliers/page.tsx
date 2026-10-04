"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import type { SupplierProfile, SourcingRule } from "@/lib/types";

const emptyForm = {
  name: "",
  website_url: "",
  domain: "",
  branch_name: "",
  account_reference: "",
  priority: "100",
  allow_substitutes: true,
  web_search_enabled: true,
};

export default function SuppliersPage() {
  const { workspace, updateSettings } = useStore();
  const [rows, setRows] = useState<SupplierProfile[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [rules, setRules] = useState<SourcingRule[]>([]);
  const [ruleForm, setRuleForm] = useState({ category: "", preferred_supplier_id: "", preferred_manufacturer: "", allow_substitutes: true });
  const [busy, setBusy] = useState(false);
  const [priceForm, setPriceForm] = useState({ supplier_id: "", product_name: "", manufacturer: "", mpn: "", upc: "", supplier_sku: "", price: "", unit: "", product_url: "", source_reference: "", source_type: "manual_verified" });

  const load = async () => {
    const response = await fetch("/api/suppliers");
    const data = await response.json().catch(() => null) as { rows?: SupplierProfile[]; rules?: SourcingRule[]; error?: string } | null;
    if (!response.ok) {
      toast.error(data?.error || "Could not load suppliers.");
      return;
    }
    setRows(data?.rows || []);
    setRules(data?.rules || []);
  };

  useEffect(() => { void load(); }, []);

  const addSupplier = async () => {
    if (!form.name.trim()) {
      toast.error("Supplier name is required.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveSupplier",
          supplier: {
            name: form.name,
            website_url: form.website_url,
            domain: form.domain,
            branch_name: form.branch_name,
            account_reference: form.account_reference,
            priority: Number(form.priority || 100),
            allow_substitutes: form.allow_substitutes,
            web_search_enabled: form.web_search_enabled,
            enabled: true,
            approved: true,
          },
        }),
      });
      const data = await response.json().catch(() => null) as { rows?: SupplierProfile[]; error?: string } | null;
      if (!response.ok) {
        toast.error(data?.error || "Could not save supplier.");
        return;
      }
      setRows(data?.rows || []);
      setForm(emptyForm);
      toast.success("Supplier added");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sourcing"
        title="Suppliers"
        description="Choose the suppliers Stockr searches first when identifying and sourcing products. Works for every trade."
        icon={<Building2 className="size-7 text-primary" />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Search className="size-5 text-primary" />Identification search policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Search selected suppliers first</p>
              <p className="text-sm text-muted-foreground">Company catalog and purchase history are checked first, then the suppliers below.</p>
            </div>
            <Switch
              checked={workspace.settings.supplier_web_search}
              onCheckedChange={async (checked) => {
                const result = await updateSettings({ supplier_web_search: checked });
                if (!result.ok) toast.error(result.error || "Could not save.");
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Allow broader web fallback</p>
              <p className="text-sm text-muted-foreground">If selected suppliers do not identify the product, Stockr may use manufacturer/public product sources and broader web lookup.</p>
            </div>
            <Switch
              checked={workspace.settings.allow_broad_web_search}
              onCheckedChange={async (checked) => {
                const result = await updateSettings({ allow_broad_web_search: checked });
                if (!result.ok) toast.error(result.error || "Could not save.");
              }}
            />
          </div>
          <div className="rounded-xl border bg-muted/30 p-4 text-sm">
            <p className="font-semibold">Verified pricing only</p>
            <p className="mt-1 text-muted-foreground">
              Stockr does not estimate supplier prices. A price is shown only when it comes from a supplier product page, API/EDI/cXML/price file, verified quote/invoice, manual verified source, or your actual purchase history. Otherwise it displays Price unavailable.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Add supplier</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Supplier name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ferguson, Grainger, local supply house..." />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://supplier.com" />
            </div>
            <div className="space-y-2">
              <Label>Domain</Label>
              <Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="supplier.com" />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Input type="number" min="1" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Branch / location</Label>
              <Input value={form.branch_name} onChange={(e) => setForm({ ...form, branch_name: e.target.value })} placeholder="Preferred branch" />
            </div>
            <div className="space-y-2">
              <Label>Account reference</Label>
              <Input value={form.account_reference} onChange={(e) => setForm({ ...form, account_reference: e.target.value })} placeholder="Internal customer/account reference" />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.web_search_enabled} onCheckedChange={(checked) => setForm({ ...form, web_search_enabled: checked })} />
              Search this supplier during Photo ID
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.allow_substitutes} onCheckedChange={(checked) => setForm({ ...form, allow_substitutes: checked })} />
              Allow substitute suggestions
            </label>
          </div>
          <Button onClick={addSupplier} disabled={busy}>
            <Plus className="mr-2 size-4" />{busy ? "Adding…" : "Add supplier"}
          </Button>
        </CardContent>
      </Card>


      <Card>
        <CardHeader><CardTitle>Category sourcing rules</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Rules are trade-agnostic. Use any category your company needs: Valves, Fasteners, Lumber, Filters, Safety, Roofing, Electrical, Plumbing, HVAC, or your own category.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Input value={ruleForm.category} onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })} placeholder="e.g. Fasteners" />
            </div>
            <div className="space-y-2">
              <Label>Preferred supplier</Label>
              <Select value={ruleForm.preferred_supplier_id || "none"} onValueChange={(value) => setRuleForm({ ...ruleForm, preferred_supplier_id: value === "none" ? "" : value })}>
                <SelectTrigger><SelectValue placeholder="No specific supplier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific supplier</SelectItem>
                  {rows.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preferred manufacturer</Label>
              <Input value={ruleForm.preferred_manufacturer} onChange={(e) => setRuleForm({ ...ruleForm, preferred_manufacturer: e.target.value })} placeholder="Optional manufacturer preference" />
            </div>
            <label className="flex items-center gap-2 pt-7 text-sm">
              <Switch checked={ruleForm.allow_substitutes} onCheckedChange={(checked) => setRuleForm({ ...ruleForm, allow_substitutes: checked })} />
              Allow substitute suggestions
            </label>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              if (!ruleForm.category.trim()) return toast.error("Category is required.");
              const response = await fetch("/api/suppliers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "saveRule", rule: ruleForm }),
              });
              const data = await response.json().catch(() => null) as { rules?: SourcingRule[]; error?: string } | null;
              if (!response.ok) return toast.error(data?.error || "Could not save sourcing rule.");
              setRules(data?.rules || []);
              setRuleForm({ category: "", preferred_supplier_id: "", preferred_manufacturer: "", allow_substitutes: true });
              toast.success("Sourcing rule saved");
            }}
          >
            Add sourcing rule
          </Button>
          <div className="space-y-2">
            {rules.map((rule) => {
              const supplier = rows.find((row) => row.id === rule.preferred_supplier_id);
              return (
                <div key={rule.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <p className="font-medium">{rule.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {(supplier ? "Supplier: " + supplier.name : "Any approved supplier")}
                      {rule.preferred_manufacturer ? " · Manufacturer: " + rule.preferred_manufacturer : ""}
                      {" · " + (rule.allow_substitutes ? "Substitutes allowed" : "Exact preference only")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      const response = await fetch("/api/suppliers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "deleteRule", ruleId: rule.id }),
                      });
                      const data = await response.json().catch(() => null) as { rules?: SourcingRule[]; error?: string } | null;
                      if (!response.ok) return toast.error(data?.error || "Could not remove rule.");
                      setRules(data?.rules || []);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader><CardTitle>Record verified supplier price</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use this for an actual quote, invoice, account price, supplier page, or price-file value. A source URL or reference is mandatory whenever a price is entered.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={priceForm.supplier_id || "none"} onValueChange={(value) => setPriceForm({ ...priceForm, supplier_id: value === "none" ? "" : value })}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select supplier</SelectItem>
                  {rows.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Product name *</Label>
              <Input value={priceForm.product_name} onChange={(e) => setPriceForm({ ...priceForm, product_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Manufacturer / MPN</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input value={priceForm.manufacturer} onChange={(e) => setPriceForm({ ...priceForm, manufacturer: e.target.value })} placeholder="Manufacturer" />
                <Input value={priceForm.mpn} onChange={(e) => setPriceForm({ ...priceForm, mpn: e.target.value })} placeholder="MPN" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>UPC / Supplier SKU</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input value={priceForm.upc} onChange={(e) => setPriceForm({ ...priceForm, upc: e.target.value })} placeholder="UPC" />
                <Input value={priceForm.supplier_sku} onChange={(e) => setPriceForm({ ...priceForm, supplier_sku: e.target.value })} placeholder="Supplier SKU" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Exact price / unit</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" min="0" step="0.0001" value={priceForm.price} onChange={(e) => setPriceForm({ ...priceForm, price: e.target.value })} placeholder="Price" />
                <Input value={priceForm.unit} onChange={(e) => setPriceForm({ ...priceForm, unit: e.target.value })} placeholder="each, ft, box..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Verified source type</Label>
              <Select value={priceForm.source_type} onValueChange={(value) => setPriceForm({ ...priceForm, source_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual_verified">Verified manual/account price</SelectItem>
                  <SelectItem value="supplier_page">Supplier product page</SelectItem>
                  <SelectItem value="price_file">Supplier price file</SelectItem>
                  <SelectItem value="edi">EDI</SelectItem>
                  <SelectItem value="cxml">cXML</SelectItem>
                  <SelectItem value="supplier_api">Supplier API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Supplier product URL</Label>
              <Input value={priceForm.product_url} onChange={(e) => setPriceForm({ ...priceForm, product_url: e.target.value })} placeholder="https://supplier.com/product..." />
            </div>
            <div className="space-y-2">
              <Label>Quote / invoice / source reference</Label>
              <Input value={priceForm.source_reference} onChange={(e) => setPriceForm({ ...priceForm, source_reference: e.target.value })} placeholder="Quote 4821, Invoice 7731, file name..." />
            </div>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              if (!priceForm.supplier_id || !priceForm.product_name.trim()) return toast.error("Supplier and product name are required.");
              if (priceForm.price && !priceForm.product_url.trim() && !priceForm.source_reference.trim()) {
                return toast.error("A verified price requires a supplier URL or source reference.");
              }
              const response = await fetch("/api/suppliers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "recordVerifiedOffer",
                  offer: {
                    ...priceForm,
                    price: priceForm.price === "" ? null : Number(priceForm.price),
                    currency: "USD",
                    exact_match: Boolean(priceForm.mpn.trim() || priceForm.upc.trim()),
                  },
                }),
              });
              const data = await response.json().catch(() => null) as { error?: string } | null;
              if (!response.ok) return toast.error(data?.error || "Could not save verified price.");
              setPriceForm({ supplier_id: "", product_name: "", manufacturer: "", mpn: "", upc: "", supplier_sku: "", price: "", unit: "", product_url: "", source_reference: "", source_type: "manual_verified" });
              toast.success("Verified supplier price saved");
            }}
          >
            Save verified price
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Preferred supplier order</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!rows.length ? <p className="text-sm text-muted-foreground">No suppliers selected yet.</p> : null}
          {rows.map((supplier) => {
            const saveSupplierPatch = async (patch: Partial<SupplierProfile>) => {
              const response = await fetch("/api/suppliers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "saveSupplier", supplier: { ...supplier, ...patch } }),
              });
              const data = await response.json().catch(() => null) as { rows?: SupplierProfile[]; error?: string } | null;
              if (!response.ok) return toast.error(data?.error || "Could not update supplier.");
              setRows(data?.rows || []);
            };
            return (
              <div key={supplier.id} className="space-y-3 rounded-xl border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{supplier.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {supplier.branch_name || "All branches"}
                      {supplier.domain ? " · " + supplier.domain : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      const response = await fetch("/api/suppliers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "deleteSupplier", supplierId: supplier.id }),
                      });
                      const data = await response.json().catch(() => null) as { rows?: SupplierProfile[]; error?: string } | null;
                      if (!response.ok) return toast.error(data?.error || "Could not remove supplier.");
                      setRows(data?.rows || []);
                      toast.success("Supplier removed");
                    }}
                  >
                    <Trash2 className="mr-2 size-4" />Remove
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Priority</Label>
                    <Input
                      type="number"
                      min="1"
                      defaultValue={supplier.priority}
                      onBlur={(e) => {
                        const priority = Number(e.target.value || supplier.priority);
                        if (priority !== supplier.priority) void saveSupplierPatch({ priority });
                      }}
                    />
                  </div>
                  <label className="flex items-center gap-2 pt-6 text-sm">
                    <Switch checked={supplier.approved} onCheckedChange={(approved) => void saveSupplierPatch({ approved })} />
                    Approved supplier
                  </label>
                  <label className="flex items-center gap-2 pt-6 text-sm">
                    <Switch checked={supplier.enabled} onCheckedChange={(enabled) => void saveSupplierPatch({ enabled })} />
                    Include in sourcing
                  </label>
                  <label className="flex items-center gap-2 pt-6 text-sm">
                    <Switch checked={supplier.web_search_enabled} onCheckedChange={(web_search_enabled) => void saveSupplierPatch({ web_search_enabled })} />
                    Search supplier site
                  </label>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
