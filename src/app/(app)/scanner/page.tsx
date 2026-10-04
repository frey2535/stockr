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
import { matchMaterial, type ParsedAction } from "@/lib/nlp";
import {
  enqueueOfflineAction,
  flushOfflineQueue,
  readOfflineQueue,
  readScannerPrefs,
  writeScannerPrefs,
} from "@/lib/offline-queue";
import { actionVerb, needsFrom, needsProject, needsTo } from "@/lib/tx";
import { isCompleteIdentity, isWeakIdentity, type IdentityField, type PhotoIdentityResult } from "@/lib/identify-photo";
import { readCodesFromVideo } from "@/lib/live-barcode";
import { prepareCameraPhoto } from "@/lib/photo-barcode";
import { planVoiceCommand, voiceSearchQuery } from "@/lib/voice-command";
import type { IdentifiedProduct, InventoryAction, Material, ProductSourceResult, TxType } from "@/lib/types";

function asIdentityFields(values?: string[]): IdentityField[] {
  const allowed: IdentityField[] = ["name", "barcode", "mpn"];
  const found = (values || []).filter((value): value is IdentityField => allowed.includes(value as IdentityField));
  return found.length ? found : allowed;
}

function identityMissingCopy(source: string, missing: string[]) {
  const fields = missing.join(", ");
  if (source === "voice") {
    return `That spoken item is not in this company catalog yet. Enter the name, barcode, and manufacturer number (missing ${fields}).`;
  }
  if (source === "scan") {
    return `This barcode is not in the catalog yet. Enter the name, barcode, and manufacturer number (missing ${fields}).`;
  }
  return `A photo is not an identity. Enter the name, barcode, and manufacturer number (missing ${fields}).`;
}

async function loadVoiceCatalog(transcript: string) {
  const query = voiceSearchQuery(transcript);
  const first = await fetch(`/api/materials?q=${encodeURIComponent(query)}&limit=100`);
  const firstData = (await first.json().catch(() => null)) as { rows?: Material[] } | null;
  const rows = [...(firstData?.rows || [])];
  if (query && matchMaterial(query, rows).match) return rows;
  const fallback = await fetch("/api/materials?limit=200");
  const fallbackData = (await fallback.json().catch(() => null)) as { rows?: Material[] } | null;
  const merged = new Map(rows.map((row) => [row.id, row]));
  for (const row of fallbackData?.rows || []) merged.set(row.id, row);
  return [...merged.values()];
}

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
  const [productSources, setProductSources] = useState<ProductSourceResult | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftBarcode, setDraftBarcode] = useState("");
  const [draftMpn, setDraftMpn] = useState("");
  const [draftManufacturer, setDraftManufacturer] = useState("");
  const [identityMissing, setIdentityMissing] = useState<string[]>([]);
  const [detectedItems, setDetectedItems] = useState<Array<PhotoIdentityResult & { key: string; name: string; barcode: string; mpn: string }>>([]);
  const [actionType, setActionType] = useState<TxType>("use");
  const [quantity, setQuantity] = useState("1");
  const [fromId, setFromId] = useState(defaultVan);
  const [toId, setToId] = useState(locations[0]?.id || "");
  const [project, setProject] = useState("");
  const [smart, setSmart] = useState("");
  const [parsedPreview, setParsedPreview] = useState<ParsedAction | null>(null);
  const [onHandByLocation, setOnHandByLocation] = useState<Record<string, number>>({});
  const [queued, setQueued] = useState(() => readOfflineQueue().length);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
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
    setProductSources(null);
    setUnknownCode("");
    try {
      const response = await fetch(`/api/materials?barcode=${encodeURIComponent(trimmed)}&q=${encodeURIComponent(trimmed)}`);
      const data = (await response.json().catch(() => null)) as {
        rows?: Material[];
        onHandByLocation?: Record<string, number>;
        identified?: IdentifiedProduct | null;
      } | null;
      const found = data?.rows?.find((row) => materialMatchesCode(row, trimmed));
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
      const product: IdentifiedProduct = data?.identified
        ? { ...data.identified, barcode: data.identified.barcode || trimmed }
        : { name: "", barcode: trimmed, source: "scan" };
      const identifiedName = product.name;
      const identifiedMpn = product.mpn || "";
      setDraftName(identifiedName && !/^scanned item\b/i.test(identifiedName) ? identifiedName : "");
      setDraftBarcode(product.barcode || trimmed);
      setDraftMpn(identifiedMpn);
      setDraftManufacturer(product.manufacturer || product.brand || "");
      if (isCompleteIdentity(product)) {
        setIdentified(product);
        setIdentityMissing([]);
        setUnknownCode("");
        toast.success(`Identified ${product.name}. Add it to the catalog and inventory.`);
        return;
      }
      setIdentified(identifiedName ? product : null);
      setIdentityMissing(["name", "barcode", "mpn"].filter((field) => {
        if (field === "name") return !identifiedName || /^scanned item\b/i.test(identifiedName);
        if (field === "barcode") return !trimmed;
        return !identifiedMpn;
      }));
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
      try {
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
        let frames = 0;
        const tick = async () => {
          if (!scanningRef.current || !videoRef.current) return;
          frames += 1;
          try {
            const read = await readCodesFromVideo(videoRef.current, frames % 2 === 0);
            const value = read.codes[0]?.trim();
            if (value) {
              if (value === lastCodeRef.current) hitsRef.current += 1;
              else {
                lastCodeRef.current = value;
                hitsRef.current = 1;
              }
              if (read.source === "native" || hitsRef.current >= 2) {
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
      notes: `Scan: ${actionVerb(actionType).toLowerCase()} ${selected.name}`,
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

  const addIdentifiedToCatalog = async (
    product: IdentifiedProduct,
    receiveNow = false,
    fields?: { name?: string; barcode?: string; mpn?: string },
    stayOnList = false,
  ) => {
    const name = (fields?.name ?? draftName).trim() || product.name;
    const code = (fields?.barcode ?? draftBarcode).trim() || product.barcode || unknownCode;
    const mpn = (fields?.mpn ?? draftMpn).trim() || product.mpn || "";
    if (!name || !code || !mpn) {
      toast.error("Name, barcode, and manufacturer number are required to identify an item.");
      return null;
    }
    const created = await upsertMaterial({
      name,
      barcode: code,
      upc: product.upc || code,
      mpn,
      manufacturer: (fields as { manufacturer?: string } | undefined)?.manufacturer || draftManufacturer || product.manufacturer || product.brand,
      category: product.category,
      description: product.description,
      image_url: product.image_url,
      unit: "each",
    });
    if (!created.ok) {
      toast.error(created.error);
      return null;
    }
    if (stayOnList) {
      toast.success(`Added ${created.material.name} to the catalog`);
      return created.material;
    }
    setSelected(created.material);
    setIdentified(null);
    setDetectedItems([]);
    setUnknownCode("");
    setIdentityMissing([]);
    setDraftMpn("");
    setOnHandByLocation({});
    setBarcode("");
    if (receiveNow) {
      const dest = toId || defaultVan;
      if (!dest) {
        toast.error("Add a warehouse or truck first, then receive this item.");
        return created.material;
      }
      setActionType("receive");
      setToId(dest);
      const received = await commitAction({
        type: "receive",
        materialId: created.material.id,
        quantity: parseFloat(quantity) || 1,
        fromLocationId: null,
        toLocationId: dest,
        project: null,
        notes: `Photo ID: added ${created.material.name} to catalog and inventory`,
      });
      if (!received.ok) {
        toast.error(received.error);
        return created.material;
      }
      toast.success(`Added ${created.material.name} to catalog and inventory`);
      setSelected(null);
      setQuantity("1");
      return created.material;
    } else {
      toast.success(`Added ${created.material.name} to the catalog`);
    }
    window.setTimeout(() => qtyRef.current?.focus(), 50);
    return created.material;
  };

  const createUnknown = async () => {
    if (!draftName.trim() || !draftBarcode.trim() || !draftMpn.trim()) {
      toast.error("Name, barcode, and manufacturer number are required.");
      return;
    }
    const created = await upsertMaterial({
      name: draftName.trim(),
      barcode: draftBarcode.trim() || unknownCode,
      upc: draftBarcode.trim() || unknownCode,
      mpn: draftMpn.trim(),
      manufacturer: draftManufacturer.trim(),
      unit: "each",
    });
    if (!created.ok) {
      toast.error(created.error);
      return;
    }
    setUnknownCode("");
    setIdentityMissing([]);
    const dest = toId || defaultVan;
    if (dest) {
      const received = await commitAction({
        type: "receive",
        materialId: created.material.id,
        quantity: parseFloat(quantity) || 1,
        fromLocationId: null,
        toLocationId: dest,
        project: null,
        notes: `Scan: added ${created.material.name} to catalog and inventory`,
      });
      if (!received.ok) {
        setSelected(created.material);
        toast.error(received.error);
        return;
      }
      toast.success(`Added ${created.material.name} to catalog and inventory`);
      setSelected(null);
      return;
    }
    setSelected(created.material);
    toast.success("Material created. Receive it into a location when you have one.");
  };

  const processSmart = async (text = smart) => {
    await runVoice(text);
  };

  const runVoice = async (transcript: string) => {
    setSmart(transcript);
    const rows = await loadVoiceCatalog(transcript);
    const plan = planVoiceCommand(transcript, rows, locations, projects);
    setParsedPreview(plan.parsed);
    if (!plan.ok) {
      speak(plan.spoken);
      toast.error(plan.error);
      if (plan.create && plan.parsed.itemQuery) {
        setSelected(null);
        setIdentified({
          name: plan.parsed.itemQuery,
          barcode: "",
          source: "voice",
        });
        setDraftName(plan.parsed.itemQuery);
        setDraftBarcode("");
        setDraftMpn("");
        setDraftManufacturer("");
        setIdentityMissing(["barcode", "mpn"]);
        setUnknownCode("");
        if (plan.parsed.quantity) setQuantity(String(plan.parsed.quantity));
        if (plan.parsed.action && plan.parsed.action !== "find" && plan.parsed.action !== "delete") {
          setActionType(plan.parsed.action);
        }
      }
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
      setSelected(rows.find((row) => row.id === plan.action.materialId) || null);
      if (plan.parsed.action && plan.parsed.action !== "find" && plan.parsed.action !== "delete") {
        setActionType(plan.parsed.action);
      }
      if (plan.parsed.quantity) setQuantity(String(plan.parsed.quantity));
      return;
    }
    speak(plan.spoken);
    toast.success(plan.spoken);
    setSelected(null);
    setIdentified(null);
    setUnknownCode("");
    setIdentityMissing([]);
    setOnHandByLocation({});
  };

  const applyIdentified = (
    product: IdentifiedProduct,
    onHand: Record<string, number> = {},
    rows: Material[] = [],
    missing: string[] = [],
  ) => {
    const exact = rows.find((row) => product.barcode && materialMatchesCode(row, product.barcode));
    if (exact) {
      setSelected(exact);
      setIdentified(null);
      setOnHandByLocation(onHand);
      setUnknownCode("");
      setIdentityMissing([]);
      toast.success(`Found ${exact.name}`);
      window.setTimeout(() => qtyRef.current?.focus(), 50);
      return;
    }
    const complete = isCompleteIdentity(product) && missing.length === 0;
    setSelected(null);
    setIdentified(product);
    setDraftName(complete || !isWeakIdentity(product) ? product.name : "");
    setDraftBarcode(product.barcode || "");
    setDraftMpn(product.mpn || "");
    setDraftManufacturer(product.manufacturer || product.brand || "");
    setIdentityMissing(complete ? [] : missing.length ? missing : ["name", "barcode", "mpn"].filter((field) => {
      if (field === "name") return !complete;
      if (field === "barcode") return !product.barcode;
      return !product.mpn;
    }));
    setUnknownCode(complete ? "" : product.barcode || "");
    setOnHandByLocation({});
    if (complete) toast.success(`Identified ${product.name}`);
    else if (product.name && !isWeakIdentity(product) && product.barcode) {
      toast.success(`Identified ${product.name}`);
    } else if (product.name && !isWeakIdentity(product)) {
      toast.message(`Recognized ${product.name}. Looking up barcode and manufacturer number.`);
    } else toast.message("Could not recognize this item. Photograph the product itself.");
  };

  const identifyPhoto = async (file: File) => {
    setPhotoBusy(true);
    setIdentified(null);
    setUnknownCode("");
    setSelected(null);
    setIdentityMissing([]);
    setDetectedItems([]);
    try {
      const prepared = await prepareCameraPhoto(file);
      setPhotoPreview(prepared.imageDataUrl);
      const response = await fetch("/api/identify-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: prepared.imageDataUrl, barcode: prepared.barcode, barcodes: prepared.barcodes }),
      });
      if (!response.ok) {
        toast.error(response.status === 504 || response.status === 524 ? "Photo ID timed out. Try a closer photo of one item." : "Photo ID failed. Try again.");
        applyIdentified({ name: "", barcode: "", source: "photo" }, {}, [], ["name", "barcode", "mpn"]);
        return;
      }
      const data = (await response.json().catch(() => null)) as {
        items?: PhotoIdentityResult[];
        identified?: IdentifiedProduct | null;
        draft?: { name?: string; barcode?: string; mpn?: string; brand?: string; manufacturer?: string; description?: string; image_url?: string; source?: string };
        missing?: IdentityField[];
        rows?: Material[];
        onHandByLocation?: Record<string, number>;
        error?: string;
        supplierSources?: ProductSourceResult[];
      } | null;
      if (data?.error) toast.message(data.error);
      setProductSources(data?.supplierSources?.[0] || null);
      const fallback: PhotoIdentityResult = {
        identified: data?.identified || null,
        draft: {
          name: data?.draft?.name || "",
          barcode: data?.draft?.barcode || prepared.barcode || "",
          mpn: data?.draft?.mpn || "",
          source: data?.draft?.source || "photo",
        },
        missing: asIdentityFields(data?.missing),
      };
      const items = (data?.items?.length ? data.items : [fallback]).map((item, index) => ({
        ...item,
        key: `${item.identified?.barcode || item.draft.barcode || "item"}-${index}`,
        name: item.identified?.name || item.draft.name,
        barcode: item.identified?.barcode || item.draft.barcode,
        mpn: item.identified?.mpn || item.draft.mpn,
      }));
      setDetectedItems(items);
      try {
        localStorage.setItem(
          "stockr_last_photo_identity",
          JSON.stringify({
            at: Date.now(),
            items: items.map((item) => ({
              name: item.name,
              barcode: item.barcode,
              mpn: item.mpn,
              missing: item.missing,
              source: item.draft.source,
            })),
          }),
        );
      } catch {
        /* private mode */
      }
      if (items.length > 1) {
        const complete = items.filter((item) => item.identified).length;
        toast.success(`Detected ${items.length} items${complete ? ` · ${complete} identified` : ""}`);
        return;
      }
      const first = items[0];
      applyIdentified(
        first.identified || {
          name: first.name,
          barcode: first.barcode,
          mpn: first.mpn,
          brand: first.draft.brand,
          manufacturer: first.draft.manufacturer,
          description: first.draft.description,
          image_url: first.draft.image_url,
          source: first.draft.source || "photo",
        },
        data?.onHandByLocation || {},
        data?.rows || [],
        first.missing,
      );
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
        description="Scan a barcode or photograph the item. Stockr identifies name, barcode, manufacturer, and part number, then prompts you to add new material to catalog and inventory."
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
              Photograph the product itself. Stockr names it and produces the barcode — you do not need to scan one first.
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
                  {photoBusy ? "Identifying…" : "Photo"}
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
          <CardContent className="p-5 text-sm text-muted-foreground">
            {photoBusy ? "Recognizing the item in this photo…" : "Identifying…"}
          </CardContent>
        </Card>
      ) : null}

      {detectedItems.length > 1 ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">{detectedItems.length} items in this photo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Each row needs a name, barcode, and manufacturer number before it is identified.
            </p>
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="Detected items" className="mt-2 h-28 w-auto rounded-lg border bg-white object-contain" />
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {detectedItems.map((item) => {
              const complete = Boolean(item.identified) && !item.missing.length && item.name && item.barcode && item.mpn;
              const product = item.identified || {
                name: item.name,
                barcode: item.barcode,
                mpn: item.mpn,
                source: item.draft.source || "photo",
              };
              return (
                <div key={item.key} className="space-y-2 rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{item.name || "Unnamed item"}</p>
                    <Badge variant="outline">{complete ? "Identified" : `Needs ${item.missing.join(", ") || "fields"}`}</Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input
                      value={item.name}
                      placeholder="Name"
                      onChange={(event) =>
                        setDetectedItems((rows) =>
                          rows.map((row) => (row.key === item.key ? { ...row, name: event.target.value } : row)),
                        )
                      }
                    />
                    <Input
                      value={item.barcode}
                      placeholder="Barcode"
                      onChange={(event) =>
                        setDetectedItems((rows) =>
                          rows.map((row) => (row.key === item.key ? { ...row, barcode: event.target.value } : row)),
                        )
                      }
                    />
                    <Input
                      value={item.mpn}
                      placeholder="Manufacturer number"
                      onChange={(event) =>
                        setDetectedItems((rows) =>
                          rows.map((row) => (row.key === item.key ? { ...row, mpn: event.target.value } : row)),
                        )
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={!item.name.trim() || !item.barcode.trim() || !item.mpn.trim()}
                    onClick={async () => {
                      const created = await addIdentifiedToCatalog(
                        product,
                        false,
                        { name: item.name, barcode: item.barcode, mpn: item.mpn },
                        true,
                      );
                      if (created) setDetectedItems((rows) => rows.filter((row) => row.key !== item.key));
                    }}
                  >
                    Add to catalog
                  </Button>
                </div>
              );
            })}
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                const ready = detectedItems.filter((item) => item.name.trim() && item.barcode.trim() && item.mpn.trim());
                for (const item of ready) {
                  const created = await addIdentifiedToCatalog(
                    item.identified || { name: item.name, barcode: item.barcode, mpn: item.mpn, source: "photo" },
                    false,
                    { name: item.name, barcode: item.barcode, mpn: item.mpn },
                    true,
                  );
                  if (created) setDetectedItems((rows) => rows.filter((row) => row.key !== item.key));
                }
              }}
            >
              Add all identified
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {identified && detectedItems.length <= 1 ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">
              {identityMissing.length ? "Not identified" : identified.name}
            </CardTitle>
            {(identified.manufacturer || identified.brand || identified.mpn || identified.barcode) ? (
              <p className="text-sm text-muted-foreground">
                {[identified.manufacturer || identified.brand, identified.mpn, identified.barcode]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            {identityMissing.length ? (
              <p className="text-sm text-muted-foreground">
                {identityMissingCopy(identified.source, identityMissing)}
              </p>
            ) : null}
            <Badge variant="outline" className="w-fit">
              {identityMissing.length
                ? "Needs name, barcode, and MPN"
                : `Identified · ${identified.source.replace(/-/g, " ")}`}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {identified.image_url || photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={identified.image_url || photoPreview}
                alt={identified.name || "Photo"}
                className="h-28 w-auto rounded-lg border bg-white object-contain"
              />
            ) : null}
            {identified.description && identityMissing.length === 0 ? (
              <p className="text-sm text-muted-foreground">{identified.description}</p>
            ) : null}
            {productSources?.preferred?.length ? (
              <div className="space-y-2 rounded-xl border p-3">
                <div>
                  <p className="text-sm font-semibold">Preferred suppliers</p>
                  <p className="text-xs text-muted-foreground">Exact verified prices only. Stockr never estimates supplier pricing.</p>
                </div>
                {productSources.preferred.map((match) => (
                  <div key={match.supplier.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/30 p-3">
                    <div>
                      <p className="text-sm font-medium">{match.supplier.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {match.exactMatch ? "Exact product match" : "No exact supplier match"}
                        {match.offer?.supplier_sku ? " · SKU " + match.offer.supplier_sku : ""}
                      </p>
                      {match.offer?.product_url ? (
                        <a className="text-xs text-primary underline" href={match.offer.product_url} target="_blank" rel="noreferrer">
                          View supplier source
                        </a>
                      ) : null}
                    </div>
                    <div className="text-right">
                      {match.priceStatus === "verified" && match.offer?.price != null ? (
                        <>
                          <p className="font-semibold">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: match.offer.currency || "USD" }).format(match.offer.price)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{match.offer.source_type.replace(/_/g, " ")} · {new Date(match.offer.observed_at).toLocaleDateString()}</p>
                        </>
                      ) : (
                        <p className="text-sm font-medium text-muted-foreground">Price unavailable</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Name *</Label>
                <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Trade name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Manufacturer</Label>
                <Input
                  value={draftManufacturer}
                  onChange={(event) => setDraftManufacturer(event.target.value)}
                  placeholder="Manufacturer"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Barcode / UPC *</Label>
                <Input value={draftBarcode} onChange={(event) => setDraftBarcode(event.target.value)} placeholder="012345678905" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Manufacturer number *</Label>
                <Input value={draftMpn} onChange={(event) => setDraftMpn(event.target.value)} placeholder="Catalog / MPN" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {identityMissing.length
                ? "Name, barcode, and manufacturer number identify the item. Then add it to catalog and inventory."
                : "This item is not in your catalog yet. Add it and receive the first count."}
            </p>
            {locations.length ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Receive into</Label>
                  <Select value={toId || defaultVan} onValueChange={setToId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantity</Label>
                  <Input type="number" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-destructive">Add a warehouse or truck before receiving inventory.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!draftName.trim() || !draftBarcode.trim() || !draftMpn.trim() || !locations.length}
                onClick={() => void addIdentifiedToCatalog(identified, true)}
              >
                Add to catalog and inventory
              </Button>
              <Button
                variant="outline"
                disabled={!draftName.trim() || !draftBarcode.trim() || !draftMpn.trim()}
                onClick={() => void addIdentifiedToCatalog(identified)}
              >
                Catalog only
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {unknownCode && !identified ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Not identified</CardTitle>
            <p className="text-sm text-muted-foreground">
              Barcode {unknownCode} is not in this company catalog yet. Enter the identity and add it to catalog and inventory.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Name *</Label>
                <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Manufacturer</Label>
                <Input value={draftManufacturer} onChange={(event) => setDraftManufacturer(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Barcode / UPC *</Label>
                <Input value={draftBarcode} onChange={(event) => setDraftBarcode(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Manufacturer number *</Label>
                <Input value={draftMpn} onChange={(event) => setDraftMpn(event.target.value)} />
              </div>
            </div>
            <Button
              disabled={!draftName.trim() || !draftBarcode.trim() || !draftMpn.trim()}
              onClick={() => void createUnknown()}
            >
              Add to catalog and inventory
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
            Speak or type the move. Stockr executes it and writes the Activity log. Example: transfer 10 3/4&quot; lbs from Noahs van to Matts truck
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
