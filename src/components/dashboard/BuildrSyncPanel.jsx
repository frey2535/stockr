import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const STATUS_CONFIG = {
  synced: { label: "Synced", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-red-100 text-red-700", icon: AlertTriangle },
  pending: { label: "Pending", color: "bg-blue-100 text-blue-700", icon: Clock },
  skipped: { label: "Skipped", color: "bg-gray-100 text-gray-700", icon: Clock },
  inconsistent: { label: "Inconsistent", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
};

function getTransactionStatus(tx) {
  // Synced
  if (tx.synced_to_buildr && tx.buildr_expense_id) return "synced";
  
  // Inconsistent: marked synced but no ID
  if (tx.synced_to_buildr && !tx.buildr_expense_id) return "inconsistent";
  
  // Failed: has error
  if (tx.sync_error) return "failed";
  
  // Pending: never attempted or mid-retry
  if (!tx.synced_to_buildr && (tx.sync_retry_count === 0 || !tx.last_sync_attempt_date)) return "pending";
  
  // Pending retry: waiting for backoff window
  if (!tx.synced_to_buildr && tx.sync_retry_count > 0) return "pending";
  
  // Skipped: no project linkage
  if (!tx.buildr_project_id && !tx.project_name) return "skipped";
  
  return "pending";
}

function isSyncableTransaction(tx) {
  return tx.type === "use" && tx.buildr_project_id;
}

export default function BuildrSyncPanel({ activeCompanyId }) {
  const [retrying, setRetrying] = useState({});
  const queryClient = useQueryClient();

  // Fetch recent syncable transactions — scoped to active company
  const { data: allTransactions = [] } = useQuery({
    queryKey: ["transactions", activeCompanyId, "sync"],
    queryFn: () => activeCompanyId
      ? base44.entities.Transaction.filter({ company_id: activeCompanyId, type: "use" }, '-updated_date', 100)
      : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  // Fetch materials for name lookup — scoped to active company
  const { data: materials = [] } = useQuery({
    queryKey: ["materials", activeCompanyId],
    queryFn: () => activeCompanyId
      ? base44.entities.Material.filter({ company_id: activeCompanyId })
      : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  // Filter to syncable and sort by recency
  const syncableTransactions = allTransactions
    .filter(isSyncableTransaction)
    .sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date))
    .slice(0, 15);

  const getMaterialName = (materialId) => {
    return materials.find(m => m.id === materialId)?.name || materialId;
  };

  const handleRetrySync = async (tx) => {
    setRetrying(prev => ({ ...prev, [tx.id]: true }));
    
    const response = await base44.functions.invoke("syncTransactionToBuildr", {
      transactionId: tx.id,
      operation: tx.buildr_expense_id ? "upsert" : "create",
    });

    if (response.data?.success) {
      toast.success(`Retry succeeded: Buildr ID ${response.data.buildr_expense_id}`);
    } else {
      toast.error(`Retry failed: ${response.data?.reason || response.data?.error}`);
    }

    queryClient.invalidateQueries({ queryKey: ["transactions", activeCompanyId, "sync"] });
    setRetrying(prev => ({ ...prev, [tx.id]: false }));
  };

  const statusCounts = {
    synced: syncableTransactions.filter(t => getTransactionStatus(t) === "synced").length,
    failed: syncableTransactions.filter(t => getTransactionStatus(t) === "failed").length,
    pending: syncableTransactions.filter(t => getTransactionStatus(t) === "pending").length,
    inconsistent: syncableTransactions.filter(t => getTransactionStatus(t) === "inconsistent").length,
  };

  return (
    <Card className="border-2 border-yellow-200 bg-yellow-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              🔧 Buildr Sync Testing Panel
              <span className="text-xs font-normal text-muted-foreground ml-2">(Admin Verification Only)</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Monitor sync status for "use" transactions. Manual retry available for testing.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary badges */}
        <div className="flex gap-2 flex-wrap">
          <Badge className="bg-green-100 text-green-700">✓ {statusCounts.synced} Synced</Badge>
          <Badge className="bg-red-100 text-red-700">✗ {statusCounts.failed} Failed</Badge>
          <Badge className="bg-blue-100 text-blue-700">⏱ {statusCounts.pending} Pending</Badge>
          {statusCounts.inconsistent > 0 && (
            <Badge className="bg-yellow-100 text-yellow-700">⚠ {statusCounts.inconsistent} Inconsistent</Badge>
          )}
        </div>

        {/* Transaction list */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {syncableTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No syncable transactions yet.</p>
          ) : (
            syncableTransactions.map(tx => {
              const status = getTransactionStatus(tx);
              const config = STATUS_CONFIG[status];
              const Icon = config.icon;
              const materialName = getMaterialName(tx.material_id);

              return (
                <div
                  key={tx.id}
                  className="border rounded-lg p-3 bg-white space-y-2 text-xs"
                >
                  {/* Header: Status + Material */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={config.color}>
                          <Icon className="w-3 h-3 mr-1" />
                          {config.label}
                        </Badge>
                        <span className="font-mono text-gray-500">{tx.id.slice(0, 8)}</span>
                      </div>
                      <p className="font-semibold text-gray-900">{materialName}</p>
                    </div>
                    {(status === "failed" || status === "inconsistent") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1"
                        onClick={() => handleRetrySync(tx)}
                        disabled={retrying[tx.id]}
                      >
                        {retrying[tx.id] ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Retrying...</>
                        ) : (
                          <><RefreshCw className="w-3 h-3" /> Retry</>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Key fields for verification */}
                  <div className="grid grid-cols-2 gap-2 text-gray-700 border-t pt-2">
                    <div>
                      <span className="text-gray-500">Qty:</span> {tx.quantity}
                    </div>
                    <div>
                      <span className="text-gray-500">Type:</span> {tx.type}
                    </div>
                    {tx.buildr_project_id && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Project ID:</span> {tx.buildr_project_id}
                      </div>
                    )}
                    {tx.buildr_expense_id && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Buildr Expense:</span>{" "}
                        <span className="font-mono bg-green-50 px-1 rounded">{tx.buildr_expense_id}</span>
                      </div>
                    )}
                  </div>

                  {/* Sync metadata */}
                  <div className="text-gray-600 border-t pt-2 space-y-1">
                    {tx.last_sync_attempt_date && (
                      <div className="text-xs">
                        <span className="text-gray-500">Last sync attempt:</span>{" "}
                        {formatDistanceToNow(new Date(tx.last_sync_attempt_date), { addSuffix: true })}
                      </div>
                    )}
                    {tx.sync_retry_count > 0 && (
                      <div className="text-xs">
                        <span className="text-gray-500">Retry count:</span> {tx.sync_retry_count} / 5
                      </div>
                    )}
                    {tx.sync_error && (
                      <div className="text-xs bg-red-50 border border-red-200 rounded p-1.5 mt-1">
                        <span className="text-red-700 font-semibold">Error:</span>{" "}
                        <span className="text-red-600">{tx.sync_error.slice(0, 120)}</span>
                        {tx.sync_error.length > 120 && "..."}
                      </div>
                    )}
                  </div>

                  {/* Timestamps */}
                  <div className="text-xs text-gray-500 border-t pt-2 flex justify-between">
                    <span>Created: {formatDistanceToNow(new Date(tx.created_date), { addSuffix: true })}</span>
                    {tx.updated_date && tx.updated_date !== tx.created_date && (
                      <span>Updated: {formatDistanceToNow(new Date(tx.updated_date), { addSuffix: true })}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}