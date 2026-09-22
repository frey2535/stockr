"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Keyboard, ScanLine, Sparkles, Trash2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { VoiceAssistant, speak } from "@/components/voice-assistant";
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
import { materialMatchesCode } from "@/lib/inventory";
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
import { planVoiceCommand } from "@/lib/voice-command";
import type { IdentifiedProduct, InventoryAction, Material, TxType } from "@/lib/types";

type Detector = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

const SCAN_FORMATS = ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39", "itf", "qr_code", "data_matrix"];

export default function ScannerPage() {
  const { workspace, applyAction, upsertMaterial, deleteMaterial } = useStore();
  const { locations, projects } = workspace;
  const defaultVan =
    locations.find((row) => row.type === "vehicle")?.id || locations[0]?.id || "";
  const [mode, setMode] = useState<"manual" | "camera">("manual");
  const [barcode, setBarcode] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [selected, setSelected] = useState<Material | null>(null);
  const [unknownCode, setUnknownCode] = useState("");
  const [identified, setIdentified] = useState<IdentifiedProduct | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
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
  const lastCodeRef = useRef("");
  const hitsRef = useRef(0);
  const qtyRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

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
    setLookingUp(true);
    setIdentified(null);
    setUnknownCode("");
    try {
      const response = await fetch(`/api/materials?barcode=${encodeURIComponent(trimmed)}&q=${encodeURIComponent(trimmed)}`);
      const data = (await response.json().catch(() => null)) as {
        rows?: Material[];
        onHandByLocation?: Record<string, number>;
        identified?: IdentifiedProduct | null;
      } | null;
      const found = data?.rows?.find((row) => materialMatchesCode(row, trimmed)) || data?.rows?.[0];
      if (found) {
        setSelected(found);
        setOnHandByLocation(data?.onHandByLocation || {});
        setBarcode("");
        toast.success(`Found ${found.name}`);
        window.setTimeout(() => qtyRef.current?.focus(), 50);
        return;
      }
      setSelected(null);
      setOnHandByLocation({});
      if (data?.identified?.name) {
        setIdentified({ ...data.identified, barcode: data.identified.barcode || trimmed });
        setUnknownCode(trimmed);
        toast.success(`Identified ${data.identified.name}`);
        return;
      }
      setUnknownCode(trimmed);
    } finally {
      setLookingUp(false);
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
    lastCodeRef.current = "";
    hitsRef.current = 0;
    const start = async () => {
      setCameraError("");
      if (!("BarcodeDetector" in window)) {
        setCameraError("This browser cannot scan from the camera. Snap a photo of the label instead.");
        setMode("manual");
        return;
      }
      try {
        const Detector = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => Detector }).BarcodeDetector;
        detectorRef.current = new Detector({ formats: SCAN_FORMATS });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
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
            const value = codes[0]?.rawValue?.trim();
            if (value) {
              if (value === lastCodeRef.current) hitsRef.current += 1;
              else {
                lastCodeRef.current = value;
                hitsRef.current = 1;
              }
              if (hitsRef.current >= 2) {
                scanningRef.current = false;
                setMode("manual");
                void lookup(value);
                return;
              }
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

  const addIdentifiedToCatalog = async (product: IdentifiedProduct, receiveNow = false) => {
    const created = await upsertMaterial({
      name: product.name,
      barcode: product.barcode || unknownCode,
      upc: product.upc || product.barcode,
      mpn: product.mpn,
      manufacturer: product.manufacturer || product.brand,
      category: product.category,
      description: product.description,
      image_url: product.image_url,
      unit: "each",
    });
    if (!created.ok) {
      toast.error(created.error);
      return null;
    }
    setSelected(created.material);
    setIdentified(null);
    setUnknownCode("");
    setOnHandByLocation({});
    setBarcode("");
    if (receiveNow) {
      setActionType("receive");
      setToId((current) => current || defaultVan);
      toast.success(`Added ${created.material.name}. Receive it into a location.`);
    } else {
      toast.success(`Added ${created.material.name} to the catalog`);
    }
    window.setTimeout(() => qtyRef.current?.focus(), 50);
    return created.material;
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

  const processSmart = async (text = smart) => {
    const parsed = parseInventoryEnglish(text);
    setParsedPreview(parsed);
    const lookupRes = await fetch(`/api/materials?q=${encodeURIComponent(parsed.itemQuery || "")}&limit=50`);
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
    if (parsed.action && parsed.action !== "delete") setActionType(parsed.action);
    if (parsed.quantity) setQuantity(String(parsed.quantity));
    if (from) setFromId(from.id);
    if (to) setToId(to.id);
    if (parsed.projectName) setProject(parsed.projectName);
    toast.success("Parsed. Review the fields, then commit.");
  };

  const runVoice = async (transcript: string) => {
    setSmart(transcript);
    const lookupRes = await fetch(`/api/materials?q=${encodeURIComponent(transcript)}&limit=80`);
    const lookupData = (await lookupRes.json().catch(() => null)) as { rows?: Material[] } | null;
    const plan = planVoiceCommand(transcript, lookupData?.rows || [], locations, projects);
    setParsedPreview(plan.parsed);
    if (!plan.ok) {
      speak(plan.spoken);
      toast.error(plan.error);
      return;
    }
    if (plan.kind === "find") {
      setSelected(plan.material);
      speak(plan.spoken);
      toast.success(plan.spoken);
      return;
    }
    if (plan.kind === "delete") {
      setSelected(plan.material);
      speak(plan.spoken);
      toast.message(plan.spoken);
      return;
    }
    const result = await commitAction(plan.action);
    if (!result.ok) {
      speak(result.error || "That move failed.");
      toast.error(result.error);
      setSelected(lookupData?.rows?.find((row) => row.id === plan.action.materialId) || null);
      if (plan.parsed.action && plan.parsed.action !== "find" && plan.parsed.action !== "delete") {
        setActionType(plan.parsed.action);
      }
      if (plan.parsed.quantity) setQuantity(String(plan.parsed.quantity));
      return;
    }
    speak(plan.spoken);
    toast.success(plan.spoken);
    setSelected(null);
    setOnHandByLocation({});
  };

  const detectFromBlob = async (file: Blob) => {
    if (!("BarcodeDetector" in window) || !("createImageBitmap" in window)) return "";
    try {
      const Detector = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => Detector }).BarcodeDetector;
      const detector = new Detector({ formats: SCAN_FORMATS });
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      bitmap.close();
      return codes[0]?.rawValue?.trim() || "";
    } catch {
      return "";
    }
  };

  const identifyPhoto = async (file: File) => {
    setPhotoBusy(true);
    setIdentified(null);
    setUnknownCode("");
    try {
      const localCode = await detectFromBlob(file);
      if (localCode) {
        await lookup(localCode);
        return;
      }
      const canvas = document.createElement("canvas");
      const image = await createImageBitmap(file);
      const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      const response = await fetch("/api/identify-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, barcode: localCode }),
      });
      const data = (await response.json().catch(() => null)) as {
        identified?: IdentifiedProduct | null;
        rows?: Material[];
        onHandByLocation?: Record<string, number>;
        error?: string;
      } | null;
      const found = data?.rows?.[0];
      if (found) {
        setSelected(found);
        setOnHandByLocation(data?.onHandByLocation || {});
        toast.success(`Found ${found.name}`);
        return;
      }
      if (data?.identified?.name) {
        setIdentified(data.identified);
        setUnknownCode(data.identified.barcode || "");
        toast.success(`Identified ${data.identified.name}`);
        return;
      }
      toast.error(data?.error || "Could not identify that photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const removeSelected = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete ${selected.name} from the catalog?`)) return;
    const result = await deleteMaterial(selected.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Deleted ${selected.name}`);
    setSelected(null);
    setOnHandByLocation({});
  };

  const vanQty = fromId ? onHandByLocation[fromId] : undefined;
  const destQty = toId ? onHandByLocation[toId] : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Field"
        title="Scanner"
        description="Scan or photograph any item. Identify it even when it is not in the catalog, then use, transfer, receive, or talk it through."
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

      <VoiceAssistant onTranscript={runVoice} />

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
                  className="absolute rounded-md border-2 border-primary"
                  style={{ top: "31%", bottom: "31%", left: "7.5%", right: "7.5%" }}
                />
              </div>
            </div>
            <div className="space-y-2 p-4">
              <p className="text-center text-sm text-muted-foreground">
                Hold steady — two matching reads lock the code
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
              Barcode, UPC, MPN, photo of the label, or voice
            </p>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void lookup(barcode);
              }}
            >
              <Input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="e.g. 012345678901 or EMT-075-10"
                className="h-12 text-center text-lg tracking-widest"
                autoFocus
              />
              <div className="grid grid-cols-3 gap-2">
                <Button type="button" variant="outline" onClick={() => setMode("camera")}>
                  <ScanLine className="mr-1 size-4" />
                  Scan
                </Button>
                <Button type="button" variant="outline" disabled={photoBusy} onClick={() => photoRef.current?.click()}>
                  <Camera className="mr-1 size-4" />
                  {photoBusy ? "Reading…" : "Photo"}
                </Button>
                <Button type="submit" disabled={!barcode.trim() || lookingUp}>
                  {lookingUp ? "…" : "Look Up"}
                </Button>
              </div>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void identifyPhoto(file);
                }}
              />
            </form>
          </CardContent>
        )}
      </Card>

      {lookingUp ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">Identifying barcode…</CardContent>
        </Card>
      ) : null}

      {identified ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">{identified.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {[identified.brand || identified.manufacturer, identified.category, identified.barcode]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <Badge variant="outline" className="w-fit">
              Identified · not in this catalog yet
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {identified.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={identified.image_url}
                alt={identified.name}
                className="h-28 w-auto rounded-lg border bg-white object-contain"
              />
            ) : null}
            {identified.description ? (
              <p className="text-sm text-muted-foreground">{identified.description}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Matched from {identified.source.replace(/-/g, " ")}. Add it, then use, transfer, receive, shrink, or return it.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void addIdentifiedToCatalog(identified)}>Add to catalog</Button>
              <Button variant="outline" onClick={() => void addIdentifiedToCatalog(identified, true)}>
                Add + receive
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {unknownCode && !identified ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Unknown barcode {unknownCode}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This code is not in the catalog and no public product record was found. Create it so you can
              receive it now.
            </p>
            <Button onClick={() => void createUnknown()}>Create material</Button>
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
            {Object.keys(onHandByLocation).length ? (
              <p className="text-xs text-muted-foreground">
                On hand:{" "}
                {locations
                  .filter((row) => onHandByLocation[row.id])
                  .map((row) => `${row.name} ${qty(onHandByLocation[row.id])}`)
                  .join(" · ") || "none"}
              </p>
            ) : null}
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
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSelected(null);
                  setIdentified(null);
                  setUnknownCode("");
                  setOnHandByLocation({});
                }}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={() => void commitScan()}>
                Commit
              </Button>
              <Button variant="outline" size="icon" onClick={() => void removeSelected()} aria-label="Delete material">
                <Trash2 className="size-4" />
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
            Type or speak an inventory action. Example: transfer 10 3/4&quot; lbs from Noahs van to Matts truck
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={smart}
            onChange={(event) => setSmart(event.target.value)}
            placeholder={`e.g. "use 10 emt from Truck 12 on Riverside" or "return 4 breakers to Truck 12 for Oak Street"`}
            className="min-h-[72px]"
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void processSmart();
            }}
          />
          <Button className="w-full" onClick={() => void processSmart()} disabled={!smart.trim()}>
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
