"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/lib/use-api";
import type { SupplierProfile } from "@/lib/types";

type ImportResult = {
  importId: string;
  processed: number;
  created: number;
  updated: number;
  priced: number;
};

export function CatalogFileImport({ onDone }: { onDone: () => Promise<void> | void }) {
  const { data } = useApi<{ rows: SupplierProfile[] }>("/api/suppliers");
  const { data: historyData, reload: reloadHistory } = useApi<{
    rows: Array<{
      id: string;
      file_name: string;
      status: string;
      row_count: number;
      created_count: number;
      updated_count: number;
      priced_count: number;
      error_message?: string | null;
      created_at: string;
    }>;
  }>("/api/catalog/import");
  const suppliers = (data?.rows || []).filter((row) => row.enabled && row.approved);
  const history = historyData?.rows || [];
  const [file, setFile] = useState<File | null>(null);
  const [supplierId, setSupplierId] = useState("none");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errors, setErrors] = useState<Array<{ row: number; message: string }>>([]);

  const upload = async () => {
    if (!file) {
      toast.error("Choose a CSV catalog file.");
      return;
    }

    setBusy(true);
    setErrors([]);
    setResult(null);
    try {
      const form = new FormData();
      form.set("file", file);
      if (supplierId !== "none") form.set("supplierId", supplierId);

      const response = await fetch("/api/catalog/import", {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => null) as
        | (Partial<ImportResult> & {
            error?: string;
            errors?: Array<{ row: number; message: string }>;
            errorCount?: number;
          })
        | null;

      if (!response.ok) {
        setErrors(payload?.errors || []);
        toast.error(payload?.error || "Catalog import failed. Nothing was imported.");
        return;
      }

      const next: ImportResult = {
        importId: String(payload?.importId || ""),
        processed: Number(payload?.processed || 0),
        created: Number(payload?.created || 0),
        updated: Number(payload?.updated || 0),
        priced: Number(payload?.priced || 0),
      };
      setResult(next);
      toast.success(`Catalog import completed: ${next.created} created, ${next.updated} updated.`);
      await Promise.all([Promise.resolve(onDone()), reloadHistory()]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <p className="font-semibold">Upload company catalog</p>
        <p className="mt-1 text-xs text-muted-foreground">
          CSV imports are validated on the server and applied transactionally. Up to 10,000 rows / 8 MB per file.
          If the file contains prices, select the approved supplier that issued the file. Stockr will not accept
          unverified supplier prices.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Catalog CSV</Label>
        <Input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            setResult(null);
            setErrors([]);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Verified supplier source</Label>
        <Select value={supplierId} onValueChange={setSupplierId} disabled={busy}>
          <SelectTrigger>
            <SelectValue placeholder="No supplier source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No supplier — file must contain no prices</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}{supplier.branch_name ? ` · ${supplier.branch_name}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          A price column is treated as verified only when it is tied to the selected company-approved supplier and this source file.
        </p>
      </div>

      <Button onClick={upload} disabled={!file || busy} className="w-full">
        <FileUp className="mr-2 size-4" />
        {busy ? "Validating and importing…" : "Validate & import catalog"}
      </Button>

      {errors.length ? (
        <div className="max-h-44 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-semibold text-destructive">Nothing was imported. Correct these rows and try again:</p>
          <ul className="mt-2 space-y-1 text-xs">
            {errors.slice(0, 25).map((error, index) => (
              <li key={index}>
                {error.row > 0 ? `CSV row ${error.row}: ` : ""}{error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result ? (
        <div className="rounded-lg border bg-background p-3 text-sm">
          <p className="font-semibold">Import complete</p>
          <p className="mt-1 text-muted-foreground">
            {result.processed} processed · {result.created} created · {result.updated} updated · {result.priced} verified price record{result.priced === 1 ? "" : "s"}.
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">Import {result.importId}</p>
        </div>
      ) : null}

      {history.length ? (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent imports</p>
          {history.slice(0, 5).map((item) => (
            <div key={item.id} className="rounded-lg border bg-background p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{item.file_name}</span>
                <span className={item.status === "completed" ? "text-emerald-700" : item.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                  {item.status}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {item.row_count} rows · {item.created_count} created · {item.updated_count} updated · {item.priced_count} prices
              </p>
              {item.error_message ? <p className="mt-1 text-destructive">{item.error_message}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
