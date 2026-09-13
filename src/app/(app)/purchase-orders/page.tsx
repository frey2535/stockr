"use client";

import { useMemo, useState } from "react";
import { Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { money } from "@/lib/format";
import type { POLine, POStatus } from "@/lib/types";

const STATUS: Record<POStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  ordered: "bg-blue-100 text-blue-700",
  partial: "bg-orange-100 text-orange-700",
  received: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function PurchaseOrdersPage() {
  const { state, createPurchaseOrder, receivePurchaseOrder, setPurchaseOrderStatus } = useStore();
  const { materials, locations, purchaseOrders } = state;
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [receiveId, setReceiveId] = useState<string | null>(null);
  const [poNumber, setPoNumber] = useState("");
  const [supplier, setSupplier] = useState("");
  const [expected, setExpected] = useState("");
  const [lines, setLines] = useState<POLine[]>([]);
  const [receiveLocation, setReceiveLocation] = useState(locations[0]?.id || "");
  const [receipts, setReceipts] = useState<Record<string, number>>({});

  const filtered = useMemo(
    () => purchaseOrders.filter((po) => status === "all" || po.status === status),
    [purchaseOrders, status],
  );

  const receiving = purchaseOrders.find((row) => row.id === receiveId);

  const addLine = () => {
    const first = materials[0];
    if (!first) return;
    setLines([
      ...lines,
      { material_id: first.id, expected_quantity: 1, received_quantity: 0, unit_cost: first.unit_cost || 0 },
    ]);
  };

  const savePo = async () => {
    if (!poNumber.trim()) {
      toast.error("PO Number is required.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one line.");
      return;
    }
    const result = await createPurchaseOrder({
      po_number: poNumber.trim(),
      supplier,
      expected_delivery: expected,
      lines,
    });
    if (!result.ok) {
      toast.error(result.error || "Could not create purchase order.");
      return;
    }
    toast.success("Purchase order created");
    setCreateOpen(false);
    setPoNumber("");
    setSupplier("");
    setExpected("");
    setLines([]);
  };

  const commitReceive = async () => {
    if (!receiving) return;
    const payload = Object.entries(receipts)
      .filter(([, qty]) => qty > 0)
      .map(([material_id, quantity]) => ({ material_id, quantity }));
    if (payload.length === 0) {
      toast.error("Enter quantities to receive.");
      return;
    }
    const result = await receivePurchaseOrder(receiving.id, receiveLocation, payload);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Stock received");
    setReceiveId(null);
    setReceipts({});
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Track orders and reconcile received stock"
        icon={<ShoppingCart className="size-7 text-secondary" />}
        actions={
          <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            New PO
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="ordered">Ordered</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filtered.length} of {purchaseOrders.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="size-12" />}
          title="No purchase orders"
          description="Create a PO to track an incoming supplier order."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((po) => {
            const expectedQty = po.lines.reduce((sum, line) => sum + line.expected_quantity, 0);
            const receivedQty = po.lines.reduce((sum, line) => sum + line.received_quantity, 0);
            const canReceive = po.status === "ordered" || po.status === "partial";
            return (
              <Card key={po.id} className="hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{po.po_number}</h3>
                        <Badge className={STATUS[po.status]}>{po.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {po.supplier || "No supplier"}
                        {po.expected_delivery ? ` · Expected ${po.expected_delivery}` : ""}
                      </p>
                      <p className="mt-2 text-sm">
                        Received {receivedQty} of {expectedQty} · {po.lines.length} line{po.lines.length === 1 ? "" : "s"}
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {po.lines.map((line) => (
                          <li key={line.material_id}>
                            {materials.find((row) => row.id === line.material_id)?.name || "Unknown"} —{" "}
                            {line.received_quantity}/{line.expected_quantity}
                            {line.unit_cost ? ` · $${money(line.unit_cost)}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col gap-2">
                      {canReceive ? (
                        <Button
                          size="sm"
                          className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                          onClick={() => {
                            setReceiveId(po.id);
                            setReceipts({});
                          }}
                        >
                          Receive
                        </Button>
                      ) : null}
                      {po.status === "ordered" || po.status === "draft" ? (
                        <Button size="sm" variant="outline" onClick={() => setPurchaseOrderStatus(po.id, "cancelled")}>
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">PO Number *</Label>
                <Input value={poNumber} onChange={(event) => setPoNumber(event.target.value)} placeholder="e.g. PO-2601-001" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Supplier</Label>
                <Input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="e.g. Crescent Electric" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expected Delivery</Label>
              <Input type="date" value={expected} onChange={(event) => setExpected(event.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Line Items</Label>
              <Button type="button" variant="outline" size="sm" className="h-7" onClick={addLine}>
                <Plus className="mr-1 size-3.5" />
                Add Line
              </Button>
            </div>
            {lines.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">No lines yet — click &quot;Add Line&quot; to add materials.</p>
            ) : null}
            {lines.map((line, index) => (
              <div key={index} className="flex items-start gap-2 rounded-lg border p-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <Select
                    value={line.material_id}
                    onValueChange={(value) => {
                      const next = [...lines];
                      next[index] = { ...next[index], material_id: value };
                      setLines(next);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          {material.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      min="1"
                      value={line.expected_quantity}
                      onChange={(event) => {
                        const next = [...lines];
                        next[index] = { ...next[index], expected_quantity: parseFloat(event.target.value) || 0 };
                        setLines(next);
                      }}
                      placeholder="Qty"
                      className="h-8 w-20 text-xs"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={line.unit_cost || 0}
                      onChange={(event) => {
                        const next = [...lines];
                        next[index] = { ...next[index], unit_cost: parseFloat(event.target.value) || 0 };
                        setLines(next);
                      }}
                      placeholder="Unit cost"
                      className="h-8 flex-1 text-xs"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setLines(lines.filter((_, i) => i !== index))}
                >
                  ×
                </Button>
              </div>
            ))}
            <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={savePo}>
              Create PO
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receiving} onOpenChange={(open) => !open && setReceiveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive {receiving?.po_number}</DialogTitle>
          </DialogHeader>
          {receiving ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Receive Into Location *</Label>
                <Select value={receiveLocation} onValueChange={setReceiveLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.type === "warehouse" ? "🏭" : "🚛"} {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {receiving.lines.map((line) => {
                const remaining = line.expected_quantity - line.received_quantity;
                return (
                  <div key={line.material_id} className="flex items-center gap-2 rounded-lg border p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {materials.find((row) => row.id === line.material_id)?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expected: {line.expected_quantity} · Already received: {line.received_quantity}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max={remaining}
                      className="h-8 w-20"
                      placeholder="Qty"
                      value={receipts[line.material_id] ?? ""}
                      onChange={(event) =>
                        setReceipts({
                          ...receipts,
                          [line.material_id]: parseFloat(event.target.value) || 0,
                        })
                      }
                    />
                  </div>
                );
              })}
              <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={commitReceive}>
                Receive stock
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
