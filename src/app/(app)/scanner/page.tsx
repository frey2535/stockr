"use client";

import { useEffect, useRef, useState } from "react";
import { Keyboard, ScanLine, Sparkles, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ProjectSelect } from "@/components/project-select";
import { useStore } from "@/lib/store";
import { materialBarcode } from "@/lib/id";
import { qty } from "@/lib/format";
import { matchLocation, matchMaterial, parseInventoryEnglish } from "@/lib/nlp";
import {
  enqueueOfflineAction,
  flushOfflineQueue,
  readOfflineQueue,
  readScannerPrefs,
  writeScannerPrefs,
} from "@/lib/offline-queue";
import { actionVerb, needsFrom, needsProject, needsTo } from "@/lib/tx";
import type { InventoryAction, Material, TxType } from "@/lib/types";

type Detector = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

export default function ScannerPage() {
  const { workspace, applyAction, upsertMaterial } = useStore();
  const { locations, projects } = workspace;
  const defaultVan =
    locations.find((row) => row.type === "vehicle")?.id || locations[0]?.id || "";
  const [mode, setMode] = useState<"manual" | "camera">("manual");
  const [barcode, setBarcode] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [selected, setSelected] = useState<Material | null>(null);
  const [unknownCode, setUnknownCode] = useState("");
  const [actionType, setActionType] = useState<TxType>("use");
  const [quantity, setQuantity] = useState("1");
  const [fromId, setFromId] = useState(defaultVan);
  const [toId, setToId] = useState(locations[0]?.id || "");
  const [project, setProject] = useState("");
  const [smart, setSmart] = useState("");
  const [parsedPreview, setParsedPreview] = useState<ReturnType<typeof parseInventoryEnglish> | null>(null);
  const [onHandByLocation, setOnHandByLocation] = useState<Record<string, number>>({});
  const [queued, setQueued] = useState(() => readOfflineQueue().length);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const scanningRef = useRef(false);
  const qtyRef = useRef<HTMLInputElement>(null);

  const rememberPrefs = (next?: Partial<{ actionType: TxType; fromId: string; toId: string; project: string }>) => {
    writeScannerPrefs({
      actionType: next?.actionType ?? actionType,
      fromId: next?.fromId ?? fromId,
      toId: next?.toId ?? toId,
      project: next?.project ?? project,
    });
  };

  const lookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    const response = await fetch(`/api/materials?barcode=${encodeURIComponent(trimmed)}&q=${encodeURIComponent(trimmed)}`);
    const data = (await response.json().catch(() => null)) as {
      rows?: Material[];
      onHandByLocation?: Record<string, number>;
    } | null;
    const found =
      data?.rows?.find((row) => row.barcode === trimmed || row.upc === trimmed || row.mpn === trimmed || materialBarcode(row) === trimmed) ||
      data?.rows?.[0];
    if (found) {
      setSelected(found);
      setOnHandByLocation(data?.onHandByLocation || {});
      setUnknownCode("");
      setBarcode("");
      toast.success(`Found ${found.name}`);
      window.setTimeout(() => qtyRef.current?.focus(), 50);
    } else {
      setSelected(null);
      setUnknownCode(trimmed);
    }
  };

  useEffect(() => {
    const prefs = readScannerPrefs();
    queueMicrotask(() => {
      if (prefs.actionType) setActionType(prefs.actionType);
      if (prefs.fromId) setFromId(prefs.fromId);
      if (prefs.toId) setToId(prefs.toId);
      if (prefs.project) setProject(prefs.project);
    });
  }, []);

  useEffect(() => {
    const syncOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    void flushOfflineQueue(applyAction).then((result) => {
      if (cancelled) return;
      if (result.flushed) toast.success(`Synced ${result.flushed} offline scan${result.flushed === 1 ? "" : "s"}`);
      setQueued(result.remaining);
    });
    return () => {
      cancelled = true;
    };
  }, [applyAction, online]);

  useEffect(() => {
    if (mode !== "camera") {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      scanningRef.current = false;
      return;
    }

    let cancelled = false;
    const start = async () => {
      setCameraError("");
      if (!("BarcodeDetector" in window)) {
        setCameraError("This browser cannot scan from the camera. Enter the barcode manually.");
        setMode("manual");
        return;
      }
      try {
        const Detector = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => Detector }).BarcodeDetector;
        detectorRef.current = new Detector({
          formats: ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39", "qr_code"],
        });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        scanningRef.current = true;
        const tick = async () => {
          if (!scanningRef.current || !videoRef.current || !detectorRef.current) return;
          try {
            const codes = await detectorRef.current.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              scanningRef.current = false;
              lookup(codes[0].rawValue);
              setMode("manual");
              return;
            }
          } catch {
            /* keep scanning */
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } catch {
        setCameraError("Camera permission was denied.");
        setMode("manual");
      }
    };
    void start();
    return () => {
      cancelled = true;
      scanningRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [mode]);

  const recentProjects = (() => {
    if (typeof window === "undefined") return [] as string[];
    try {
      return (JSON.parse(localStorage.getItem("stockr_recent_projects") || "[]") as string[]) || [];
    } catch {
      return [];
    }
  })();

  const commitAction = async (action: InventoryAction) => {
    if (!online || (typeof navigator !== "undefined" && !navigator.onLine)) {
      enqueueOfflineAction(action);
      setQueued(readOfflineQueue().length);
      toast.message("Saved offline. It will sync when you are back online.");
      return { ok: true as const, offline: true };
    }
    const result = await applyAction(action);
    if (!result.ok && result.error === "offline") {
      enqueueOfflineAction(action);
      setQueued(readOfflineQueue().length);
      toast.message("Saved offline. It will sync when you are back online.");
      return { ok: true as const, offline: true };
    }
    return result;
  };

  const commitScan = async () => {
    if (!selected) return;
    if (needsProject(actionType) && !project.trim()) {
      toast.error("Pick the job this material belongs to.");
      return;
    }
    const result = await commitAction({
      type: actionType,
      materialId: selected.id,
      quantity: parseFloat(quantity),
      fromLocationId: needsFrom(actionType) ? fromId : null,
      toLocationId: needsTo(actionType) ? toId : null,
      project: needsProject(actionType) ? project : null,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (project) {
      const next = [project, ...recentProjects.filter((name) => name !== project)].slice(0, 5);
      localStorage.setItem("stockr_recent_projects", JSON.stringify(next));
    }
    rememberPrefs();
    toast.success(`${actionVerb(actionType)} ${quantity} ${selected.name}`);
    setSelected(null);
    setQuantity("1");
    setOnHandByLocation({});
  };

  const createUnknown = async () => {
    const created = await upsertMaterial({
      name: `Unknown Product - ${unknownCode}`,
      barcode: unknownCode,
      upc: unknownCode,
      unit: "each",
    });
    if (!created.ok) {
      toast.error(created.error);
      return;
    }
    setSelected(created.material);
    setUnknownCode("");
    toast.success("Material created. Fill in the details from Catalog when you can.");
  };

  const processSmart = async () => {
    const parsed = parseInventoryEnglish(smart);
    setParsedPreview(parsed);
    const lookupRes = await fetch(`/api/materials?q=${encodeURIComponent(parsed.itemQuery || "")}`);
    const lookupData = (await lookupRes.json().catch(() => null)) as { rows?: Material[] } | null;
    const materials = lookupData?.rows || [];
    const { match } = matchMaterial(parsed.itemQuery, materials);
    const from = matchLocation(parsed.fromLocationName, locations);
    const to = matchLocation(parsed.toLocationName, locations);
    if (parsed.action === "find") {
      if (match) {
        setSelected(match);
        toast.success(`Found ${match.name}`);
      } else toast.error("No matching material.");
      return;
    }
    if (!match) {
      toast.error("Could not match a material. Try a catalog name.");
      return;
    }
    setSelected(match);
    if (parsed.action) setActionType(parsed.action);
    if (parsed.quantity) setQuantity(String(parsed.quantity));
    if (from) setFromId(from.id);
    if (to) setToId(to.id);
    if (parsed.projectName) setProject(parsed.projectName);
    toast.success("Parsed. Review the fields, then commit.");
  };

  const vanQty = fromId ? onHandByLocation[fromId] : undefined;
  const destQty = toId ? onHandByLocation[toId] : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Scanner"
        description="Scan → charge the job → van qty updates. Restock from the dashboard when a truck drops below min."
        icon={<ScanLine className="size-8 text-primary" />}
      />

      {!online || queued > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <WifiOff className="size-4" />
          {online
            ? `${queued} scan${queued === 1 ? "" : "s"} waiting to sync`
            : `Offline${queued ? ` · ${queued} queued` : ""}. Scans save on this device.`}
        </div>
      ) : null}

      <Card>
        {mode === "camera" ? (
          <div>
            <div className="relative w-full bg-black" style={{ aspectRatio: "4/3" }}>
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                autoPlay
              />
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute top-0 right-0 left-0 bg-black/50" style={{ height: "31%" }} />
                <div className="absolute right-0 bottom-0 left-0 bg-black/50" style={{ height: "31%" }} />
                <div className="absolute left-0 bg-black/50" style={{ top: "31%", bottom: "31%", width: "7.5%" }} />
                <div className="absolute right-0 bg-black/50" style={{ top: "31%", bottom: "31%", width: "7.5%" }} />
                <div
                  className="absolute rounded-md border-2 border-secondary"
                  style={{ top: "31%", bottom: "31%", left: "7.5%", right: "7.5%" }}
                />
              </div>
            </div>
            <div className="space-y-2 p-4">
              <p className="text-center text-sm text-muted-foreground">
                Hold steady — align barcode in the box
              </p>
              <Button variant="outline" className="w-full" onClick={() => setMode("manual")}>
                <Keyboard className="mr-2 size-4" />
                Enter Manually
              </Button>
            </div>
          </div>
        ) : (
          <CardContent className="space-y-4 p-5">
            {cameraError ? (
              <p className="text-center text-sm text-destructive">{cameraError}</p>
            ) : null}
            <p className="text-center text-sm text-muted-foreground">
              Barcode, UPC, MPN, or supplier number
            </p>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                lookup(barcode);
              }}
            >
              <Input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="e.g. 012345678901 or EMT-075-10"
                className="h-12 text-center text-lg tracking-widest"
                autoFocus
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setMode("camera")}>
                  <ScanLine className="mr-2 size-4" />
                  Use Camera
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={!barcode.trim()}
                >
                  Look Up
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {unknownCode ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Unknown barcode {unknownCode}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This code is not in the catalog yet. Create a material so you can receive it now.
            </p>
            <Button onClick={createUnknown}>
              Create material
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selected.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {[selected.manufacturer, selected.mpn || selected.category, materialBarcode(selected)]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {needsFrom(actionType) && fromId ? (
              <p className="text-sm font-medium">
                Van / source on hand: {qty(vanQty || 0)} {selected.unit}
              </p>
            ) : null}
            {needsTo(actionType) && destQty != null ? (
              <p className="text-sm text-muted-foreground">
                Destination on hand: {qty(destQty)} {selected.unit}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Action</Label>
                <Select
                  value={actionType}
                  onValueChange={(value) => {
                    const next = value as TxType;
                    setActionType(next);
                    rememberPrefs({ actionType: next });
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="use">Use on job</SelectItem>
                    <SelectItem value="return">Return from job</SelectItem>
                    <SelectItem value="receive">Receive</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="add">Add</SelectItem>
                    <SelectItem value="count">Cycle count</SelectItem>
                    <SelectItem value="adjust">Adjust</SelectItem>
                    <SelectItem value="shrink">Shrinkage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quantity</Label>
                <Input
                  ref={qtyRef}
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>
            </div>
            {needsFrom(actionType) ? (
              <div className="space-y-1">
                <Label className="text-xs">From Location</Label>
                <Select
                  value={fromId}
                  onValueChange={(value) => {
                    setFromId(value);
                    rememberPrefs({ fromId: value });
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select source" />
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
            ) : null}
            {needsTo(actionType) ? (
              <div className="space-y-1">
                <Label className="text-xs">To Location</Label>
                <Select
                  value={toId}
                  onValueChange={(value) => {
                    setToId(value);
                    rememberPrefs({ toId: value });
                  }}
                >
                  <SelectTrigger className="h-9">
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
            ) : null}
            {needsProject(actionType) ? (
              <div className="space-y-1">
                <Label className="text-xs">Job / Buildr project *</Label>
                <ProjectSelect
                  projects={projects}
                  value={project}
                  allowNone={false}
                  onChange={(value) => {
                    setProject(value);
                    rememberPrefs({ project: value });
                  }}
                />
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={commitScan}>
                Commit
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-2 border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-5 text-primary" />
            Smart Add / Find / Transfer / Use
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Type an inventory action in plain English
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={smart}
            onChange={(event) => setSmart(event.target.value)}
            placeholder={`e.g. "use 10 emt from Truck 12 on Riverside" or "return 4 breakers to Truck 12 for Oak Street"`}
            className="min-h-[72px]"
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) processSmart();
            }}
          />
          <Button className="w-full" onClick={processSmart} disabled={!smart.trim()}>
            Process
          </Button>
          {parsedPreview ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {parsedPreview.action ? <Badge variant="secondary">{parsedPreview.action}</Badge> : null}
              {parsedPreview.quantity ? <Badge variant="outline">qty {parsedPreview.quantity}</Badge> : null}
              {parsedPreview.itemQuery ? <Badge variant="outline">{parsedPreview.itemQuery}</Badge> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
