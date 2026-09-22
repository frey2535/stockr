"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, ClipboardCheck, PackageCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import type { FieldOpsPayload } from "@/lib/types";

const empty: FieldOpsPayload = { zones: [], bins: [], reservations: [], requests: [], countSessions: [], materials: [] };

export default function FieldOpsPage() {
  const { workspace } = useStore();
  const [data, setData] = useState<FieldOpsPayload>(empty);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState(workspace.locations[0]?.id || "");
  const [zoneName, setZoneName] = useState("");
  const [binName, setBinName] = useState("");
  const [binCode, setBinCode] = useState("");
  const [reserveMaterialId, setReserveMaterialId] = useState("");
  const [reserveQty, setReserveQty] = useState("1");
  const [requestMaterialId, setRequestMaterialId] = useState("");
  const [requestQty, setRequestQty] = useState("1");
  const [requestPriority, setRequestPriority] = useState<"normal" | "urgent" | "critical">("normal");
  const [requestDestId, setRequestDestId] = useState("");

  const materialName = (id: string) => data.materials.find((row) => row.id === id)?.name || id;

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/field-ops");
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not load field operations.");
      setData(json);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load field operations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const send = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/field-ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok) {
      toast.error(json.error || "Could not save.");
      return false;
    }
    if (json.fieldOps) setData(json.fieldOps);
    return true;
  };

  const openRequests = useMemo(
    () => data.requests.filter((row) => !["fulfilled", "cancelled"].includes(row.status)),
    [data.requests],
  );
  const activeReservations = data.reservations.filter((row) => row.status === "active");
  const openCounts = data.countSessions.filter((row) => row.status === "open");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Field operations"
        title="Material Control"
        description="Bins, reservations, requests, and cycle counts in one field workflow."
        icon={<Boxes className="size-7 text-primary" />}
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Open requests</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{openRequests.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Active reservations</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{activeReservations.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Open cycle counts</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{openCounts.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Warehouse / truck bin setup</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {workspace.locations.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>New zone</Label>
              <div className="flex gap-2">
                <Input value={zoneName} onChange={(e) => setZoneName(e.target.value)} placeholder="Aisle A / Van rear" />
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!locationId || !zoneName.trim()) return;
                    if (await send({ action: "createZone", locationId, name: zoneName })) {
                      setZoneName("");
                      toast.success("Zone added");
                    }
                  }}
                >Add</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>New bin</Label>
              <div className="grid grid-cols-[1fr_110px_auto] gap-2">
                <Input value={binName} onChange={(e) => setBinName(e.target.value)} placeholder="Shelf 3" />
                <Input value={binCode} onChange={(e) => setBinCode(e.target.value)} placeholder="A-03" />
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!locationId || !binName.trim() || !binCode.trim()) return;
                    if (await send({ action: "createBin", locationId, name: binName, code: binCode })) {
                      setBinName("");
                      setBinCode("");
                      toast.success("Bin added");
                    }
                  }}
                >Add</Button>
              </div>
            </div>
          </div>

          {data.bins.length ? (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {data.bins.map((bin) => {
                const location = workspace.locations.find((row) => row.id === bin.location_id);
                return (
                  <div key={bin.id} className="rounded-xl border p-3">
                    <p className="font-semibold">{bin.code} · {bin.name}</p>
                    <p className="text-xs text-muted-foreground">{location?.name || "Location"}</p>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-muted-foreground">No storage bins configured yet.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Hold / reserve stock</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-[1fr_140px_90px_auto]">
            <Select value={reserveMaterialId} onValueChange={setReserveMaterialId}>
              <SelectTrigger><SelectValue placeholder="Material" /></SelectTrigger>
              <SelectContent>
                {data.materials.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                {workspace.locations.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" min="0" value={reserveQty} onChange={(e) => setReserveQty(e.target.value)} />
            <Button
              variant="outline"
              onClick={async () => {
                if (!reserveMaterialId || !locationId) return;
                if (await send({ action: "reserve", materialId: reserveMaterialId, locationId, quantity: Number(reserveQty) })) {
                  toast.success("Reserved");
                }
              }}
            >
              Reserve
            </Button>
          </div>
          {!activeReservations.length ? <p className="text-sm text-muted-foreground">No active reservations.</p> : null}
          {activeReservations.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div>
                <p className="font-medium">{materialName(row.material_id)} · {row.quantity}</p>
                <p className="text-xs text-muted-foreground">
                  {workspace.locations.find((location) => location.id === row.location_id)?.name || "Location"} · {row.created_by}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void send({ action: "releaseReservation", reservationId: row.id })}>
                Release
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><PackageCheck className="size-5 text-primary" />Material requests</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-[1fr_90px]">
              <Select value={requestMaterialId} onValueChange={setRequestMaterialId}>
                <SelectTrigger><SelectValue placeholder="Material" /></SelectTrigger>
                <SelectContent>
                  {data.materials.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" min="0" value={requestQty} onChange={(e) => setRequestQty(e.target.value)} />
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
              <Select value={requestDestId} onValueChange={setRequestDestId}>
                <SelectTrigger><SelectValue placeholder="Send to" /></SelectTrigger>
                <SelectContent>
                  {workspace.locations.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={requestPriority} onValueChange={(value) => setRequestPriority(value as typeof requestPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">normal</SelectItem>
                  <SelectItem value="urgent">urgent</SelectItem>
                  <SelectItem value="critical">critical</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={async () => {
                  if (!requestMaterialId) return;
                  if (
                    await send({
                      action: "createRequest",
                      destinationLocationId: requestDestId || undefined,
                      priority: requestPriority,
                      lines: [{ materialId: requestMaterialId, quantity: Number(requestQty) }],
                    })
                  ) {
                    toast.success("Request sent");
                  }
                }}
              >
                Request
              </Button>
            </div>
            {!openRequests.length ? <p className="text-sm text-muted-foreground">No open material requests.</p> : null}
            {openRequests.map((request) => (
              <div key={request.id} className="rounded-xl border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{request.lines.length} line{request.lines.length === 1 ? "" : "s"} · {request.priority}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.lines.map((line) => `${materialName(line.material_id)} × ${line.quantity_requested}`).join(", ") || "No lines"}
                    </p>
                    <p className="text-xs text-muted-foreground">{request.requested_by} · {new Date(request.created_at).toLocaleString()}</p>
                  </div>
                  <Select
                    value={request.status}
                    onValueChange={(status) => void send({ action: "setRequestStatus", requestId: request.id, status })}
                  >
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["requested", "approved", "picking", "staged", "in_transit", "fulfilled", "cancelled"].map((status) => (
                        <SelectItem key={status} value={status}>{status.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="size-5 text-primary" />Cycle counts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
                <SelectContent>
                  {workspace.locations.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                onClick={async () => {
                  if (!locationId) return;
                  if (await send({ action: "startCount", locationId })) toast.success("Cycle count started");
                }}
              >
                Start count
              </Button>
            </div>
            {!openCounts.length ? <p className="text-sm text-muted-foreground">No open counts.</p> : null}
            {openCounts.map((session) => {
              const location = workspace.locations.find((row) => row.id === session.location_id);
              return (
                <div key={session.id} className="rounded-xl border p-3">
                  <p className="font-medium">{location?.name || "Location"}</p>
                  <p className="mb-3 text-xs text-muted-foreground">{session.lines.length} inventory lines</p>
                  <div className="space-y-2">
                    {session.lines.slice(0, 8).map((line) => (
                      <div key={line.id} className="grid grid-cols-[1fr_100px] items-center gap-2">
                        <span className="text-sm">{materialName(line.material_id)} · expected {line.expected_quantity}</span>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Count"
                          defaultValue={line.counted_quantity ?? ""}
                          onBlur={(e) => {
                            if (e.target.value === "") return;
                            void send({
                              action: "countLine",
                              sessionId: session.id,
                              materialId: line.material_id,
                              countedQuantity: Number(e.target.value),
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    className="mt-3 w-full"
                    variant="outline"
                    onClick={async () => {
                      if (await send({ action: "submitCount", sessionId: session.id })) {
                        toast.success("Cycle count posted to inventory");
                      }
                    }}
                  >
                    Submit count
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
