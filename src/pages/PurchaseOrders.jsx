import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useUserCompanyId } from "@/lib/useUserCompanyId";
import CompanyAccessGate from "@/components/CompanyAccessGate";
import { ShoppingCart, Plus, Truck, Warehouse, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { toast } from "sonner";
import PurchaseOrderForm from "../components/po/PurchaseOrderForm";
import ReceivePODialog from "../components/po/ReceivePODialog";

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-700",
  ordered: "bg-blue-100 text-blue-700",
  partial: "bg-orange-100 text-orange-700",
  received: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function PurchaseOrders() {
  const { user } = useAuth();
  const { activeCompanyId } = useUserCompanyId();
  const [showForm, setShowForm] = useState(false);
  const [receivePO, setReceivePO] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const queryClient = useQueryClient();

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ["purchaseOrders", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.PurchaseOrder.filter({ company_id: activeCompanyId }, "-created_date", 200) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.Material.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.Location.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const filtered = filterStatus === "all" ? pos : pos.filter(p => p.status === filterStatus);

  const handleCreate = async (poData) => {
    try {
      await base44.entities.PurchaseOrder.create({ ...poData, company_id: activeCompanyId });
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders", activeCompanyId] });
      toast.success(`PO ${poData.po_number} created`);
      setShowForm(false);
    } catch (err) {
      toast.error(err?.message || "Failed to create PO");
    }
  };

  const handleReceived = () => {
    queryClient.invalidateQueries({ queryKey: ["purchaseOrders", activeCompanyId] });
    queryClient.invalidateQueries({ queryKey: ["inventoryItems", activeCompanyId] });
    queryClient.invalidateQueries({ queryKey: ["transactions", activeCompanyId] });
  };

  const poContent = (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-secondary" />
            Purchase Orders
          </h1>
          <p className="text-muted-foreground mt-1">Track orders and reconcile received stock</p>
        </div>
        <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" /> New PO
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="ordered">Ordered</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} of {pos.length}</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold">No purchase orders</h3>
          <p className="text-muted-foreground mt-1">Create a PO to track an incoming supplier order.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(po => {
            const totalExpected = (po.lines || []).reduce((s, l) => s + (l.expected_quantity || 0), 0);
            const totalReceived = (po.lines || []).reduce((s, l) => s + (l.received_quantity || 0), 0);
            const canReceive = po.status === "ordered" || po.status === "partial";
            return (
              <Card key={po.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{po.po_number}</h3>
                        <Badge variant="secondary" className={`text-xs ${STATUS_STYLES[po.status] || STATUS_STYLES.draft}`}>{po.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {po.supplier || "No supplier"}
                        {po.expected_delivery_date && ` · expected ${format(new Date(po.expected_delivery_date), "MMM d")}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {totalReceived} / {totalExpected} units received · {(po.lines || []).length} line{(po.lines || []).length !== 1 ? "s" : ""}
                      </p>
                      {po.notes && <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">{po.notes}</p>}
                    </div>
                    {canReceive && (
                      <Button size="sm" variant="outline" onClick={() => setReceivePO(po)} className="flex-shrink-0">
                        <Truck className="w-4 h-4 mr-1" /> Receive
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PurchaseOrderForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleCreate}
        materials={materials}
      />
      <ReceivePODialog
        open={!!receivePO}
        po={receivePO}
        locations={locations}
        activeCompanyId={activeCompanyId}
        onClose={() => setReceivePO(null)}
        onReceived={handleReceived}
      />
    </div>
  );

  if (!user) return null;
  return <CompanyAccessGate userEmail={user.email}>{poContent}</CompanyAccessGate>;
}