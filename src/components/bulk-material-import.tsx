"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BarcodeScanButton } from "@/components/barcode-scan-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { materialFromCsv, parseMaterialCsv, type CsvMaterialRow } from "@/lib/csv";
import { codesMatch } from "@/lib/barcode";
import type { IdentifiedProduct, Material } from "@/lib/types";

export function BulkMaterialImport({
  materials,
  onCreate,
  onResolved,
  label = "Scan or import materials",
}: {
  materials: Material[];
  onCreate: (material: Partial<Material>) => Promise<{ ok: true; material: Material } | { ok: false; error: string }>;
  onResolved: (rows: Array<{ material: Material; quantity: number }>) => void;
  label?: string;
}) {
  const [unknown, setUnknown] = useState<{ barcode: string; name: string } | null>(null);

  const resolveRow = async (row: CsvMaterialRow) => {
    const found = materials.find(
      (material) =>
        (row.barcode && material.barcode === row.barcode) ||
        (row.name && material.name.toLowerCase() === row.name.toLowerCase()),
    );
    if (found) return { material: found, quantity: row.quantity };
    const created = await onCreate(materialFromCsv(row));
    if (!created.ok) throw new Error(created.error);
    return { material: created.material, quantity: row.quantity };
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const rows = parseMaterialCsv(text);
    if (!rows.length) {
      toast.error("No rows found in that file.");
      return;
    }
    try {
      const resolved = [];
      for (const row of rows) resolved.push(await resolveRow(row));
      onResolved(resolved);
      toast.success(`Imported ${resolved.length} line${resolved.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import that file.");
    }
  };

  const handleCode = async (code: string) => {
    const found = materials.find(
      (material) =>
        codesMatch(material.barcode, code) ||
        codesMatch(material.upc, code) ||
        material.mpn === code ||
        material.supplier_number === code,
    );
    if (found) {
      onResolved([{ material: found, quantity: 1 }]);
      toast.success(`Added ${found.name}`);
      return;
    }
    const response = await fetch(`/api/materials?barcode=${encodeURIComponent(code)}`);
    const data = (await response.json().catch(() => null)) as {
      rows?: Material[];
      identified?: IdentifiedProduct | null;
    } | null;
    const remote = data?.rows?.[0];
    if (remote) {
      onResolved([{ material: remote, quantity: 1 }]);
      toast.success(`Added ${remote.name}`);
      return;
    }
    setUnknown({
      barcode: code,
      name: data?.identified?.name || `Unknown Product - ${code}`,
    });
  };

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
      <p className="text-xs font-medium">{label}</p>
      <BarcodeScanButton onCode={(code) => void handleCode(code)} label="Scan purchased material" />
      <div className="space-y-1">
        <Label className="text-xs">Bulk CSV upload</Label>
        <Input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <p className="text-xs text-muted-foreground">
          Columns: name, barcode, qty, unit, category, manufacturer, supplier, unit_cost. Missing catalog
          items are created automatically.
        </p>
      </div>
      {unknown ? (
        <div className="space-y-2 rounded-lg border border-primary/40 p-3">
          <p className="text-sm font-medium">Not in catalog: {unknown.barcode}</p>
          <Input
            value={unknown.name}
            onChange={(event) => setUnknown({ ...unknown, name: event.target.value })}
            placeholder="Material name"
          />
          <Button
            type="button"
            className="w-full"
            onClick={async () => {
              const created = await onCreate({
                name: unknown.name.trim() || `Unknown Product - ${unknown.barcode}`,
                barcode: unknown.barcode,
                unit: "each",
              });
              if (!created.ok) {
                toast.error(created.error);
                return;
              }
              onResolved([{ material: created.material, quantity: 1 }]);
              setUnknown(null);
              toast.success(`${created.material.name} added to the catalog`);
            }}
          >
            Create material and add
          </Button>
        </div>
      ) : null}
    </div>
  );
}
