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
import { useStore } from "@/lib/store";
import type { SupplierProfile } from "@/lib/types";

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
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch("/api/suppliers");
    const data = await response.json().catch(() => null) as { rows?: SupplierProfile[]; error?: string } | null;
    if (!response.ok) {
      toast.error(data?.error || "Could not load suppliers.");
      return;
    }
    setRows(data?.rows || []);
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
        <CardHeader><CardTitle>Preferred supplier order</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!rows.length ? <p className="text-sm text-muted-foreground">No suppliers selected yet.</p> : null}
          {rows.map((supplier) => (
            <div key={supplier.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{supplier.name}</p>
                <p className="text-xs text-muted-foreground">
                  {"Priority " + supplier.priority}
                  {supplier.branch_name ? " · " + supplier.branch_name : ""}
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
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
