import { NextResponse } from "next/server";
import { identifyRemoteProduct, searchRemoteProduct } from "@/lib/barcode-lookup";
import { fillIdentityFromCatalog, isCompleteIdentity, resolvePhotoIdentities } from "@/lib/identify-photo";
import { materialMatchesCode } from "@/lib/inventory";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { requireAccount } from "@/lib/require-account";
import { canUseVision, completeProductIdentity, detectObjectsFromVision } from "@/lib/vision-identify";
import { getWorkspaceShell, lookupMaterials } from "@/lib/workspace-data";
import { sourceProduct } from "@/lib/supplier-intelligence";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { account, response } = await requireAccount();
  if (!account) return response;
  const limited = await rateLimit(clientKey(request, `vision:${account.company.id}`), 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Photo ID limit reached for this hour. Try again later." }, { status: 429 });
  }
  let body: { image?: string; barcode?: string; barcodes?: string[] } | null = null;
  try {
    body = (await request.json()) as { image?: string; barcode?: string; barcodes?: string[] };
  } catch {
    body = null;
  }
  const barcodes = Array.from(
    new Set([body?.barcode, ...(Array.isArray(body?.barcodes) ? body.barcodes : [])].map((value) => String(value || "").trim()).filter(Boolean)),
  );
  const image = String(body?.image || "");
  let vision: Awaited<ReturnType<typeof detectObjectsFromVision>> = { objects: [] };
  try {
    if (image.startsWith("data:image")) vision = await detectObjectsFromVision(image);
  } catch (error) {
    console.error("detectObjectsFromVision", error);
    vision = { objects: [], error: "Photo recognition failed. Try a closer photo of one item." };
  }
  const settings = (await getWorkspaceShell(account.company.id)).settings;
  const supplierSources = [] as Awaited<ReturnType<typeof sourceProduct>>[];
  const supplierFirstObjects = [] as typeof vision.objects;
  for (const object of vision.objects) {
    try {
      const sourced = await sourceProduct(account.company.id, object, {
        supplierWebSearch: settings.supplier_web_search,
        broadWebSearch: settings.allow_broad_web_search,
      });
      supplierSources.push(sourced);
      const supplierIdentity = sourced.preferred.find((row) => row.exactMatch && row.product)?.product;
      supplierFirstObjects.push(supplierIdentity ? { ...object, ...supplierIdentity, source: supplierIdentity.source } : object);
    } catch (error) {
      console.error("supplier-first identification", error);
      supplierSources.push({ preferred: [], purchaseHistory: [], broaderWebUsed: false, searchOrder: [] });
      supplierFirstObjects.push(object);
    }
  }

  let items: Awaited<ReturnType<typeof resolvePhotoIdentities>> = [];
  try {
    items = await resolvePhotoIdentities(
      supplierFirstObjects,
      barcodes,
      settings.allow_broad_web_search ? identifyRemoteProduct : async () => null,
      settings.allow_broad_web_search ? searchRemoteProduct : async () => null,
      completeProductIdentity,
    );
  } catch (error) {
    console.error("resolvePhotoIdentities", error);
    items = barcodes.length
      ? await resolvePhotoIdentities(
          [],
          barcodes,
          settings.allow_broad_web_search ? identifyRemoteProduct : async () => null,
          settings.allow_broad_web_search ? searchRemoteProduct : async () => null,
        ).catch(() => [])
      : [];
  }

  const catalogRows: Awaited<ReturnType<typeof lookupMaterials>>["rows"] = [];
  let onHandByLocation: Record<string, number> = {};
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const catalogQuery =
      item.identified?.barcode ||
      item.draft.barcode ||
      (index === 0 ? barcodes[0] : "") ||
      item.identified?.name ||
      item.draft.name ||
      "";
    if (!catalogQuery) continue;
    try {
      const catalog = await lookupMaterials(account.company.id, {
        barcode: item.identified?.barcode || item.draft.barcode || (index === 0 ? barcodes[0] : "") || "",
        q: catalogQuery,
        limit: 8,
      });
      const rows = (catalog.rows || []).filter(
        (row) =>
          materialMatchesCode(row, catalogQuery) ||
          row.name.toLowerCase().includes(catalogQuery.toLowerCase()) ||
          (row.mpn && catalogQuery.toLowerCase().includes(row.mpn.toLowerCase())),
      );
      items[index] = fillIdentityFromCatalog(item, rows.length ? rows : catalog.rows || []);
      catalogRows.push(...rows);
      if (!Object.keys(onHandByLocation).length) onHandByLocation = catalog.onHandByLocation || {};
    } catch (error) {
      console.error("identify-image catalog", error);
    }
  }
  const finalSources = [] as Awaited<ReturnType<typeof sourceProduct>>[];
  for (let index = 0; index < items.length; index += 1) {
    const product = items[index]?.identified || ({ ...items[index]?.draft, barcode: items[index]?.draft.barcode || "", source: items[index]?.draft.source || "photo" } as Parameters<typeof sourceProduct>[1]);
    if (!product?.name && !product?.mpn && !product?.barcode) {
      finalSources.push(supplierSources[index] || { preferred: [], purchaseHistory: [], broaderWebUsed: false, searchOrder: [] });
      continue;
    }
    try {
      finalSources.push(await sourceProduct(account.company.id, product, {
        supplierWebSearch: settings.supplier_web_search,
        broadWebSearch: settings.allow_broad_web_search,
      }));
    } catch {
      finalSources.push(supplierSources[index] || { preferred: [], purchaseHistory: [], broaderWebUsed: false, searchOrder: [] });
    }
  }

  const first = items[0];
  const rows = catalogRows.filter(
    (row, index, all) => all.findIndex((other) => other.id === row.id) === index,
  );
  const identifiedCount = items.filter((item) => item.identified && isCompleteIdentity(item.identified)).length;
  const named = items.some((item) => item.identified?.name || item.draft.name);
  const error =
    !vision.objects.length && !identifiedCount && image.startsWith("data:image") && !(await canUseVision())
      ? "Photo ID needs Workers AI on this deploy."
      : !named && image.startsWith("data:image")
        ? vision.error || "Could not recognize the item in this photo. Photograph the product itself."
        : undefined;

  return NextResponse.json({
    items,
    identified: first?.identified || null,
    draft: first?.draft || { name: "", barcode: "", mpn: "", source: "photo" },
    missing: first?.missing || ["name", "barcode", "mpn"],
    count: items.length,
    rows,
    onHandByLocation,
    supplierSources: finalSources,
    sourcePolicy: {
      supplierWebSearch: settings.supplier_web_search,
      broadWebSearch: settings.allow_broad_web_search,
      priceRule: "verified-source-only",
    },
    error,
  });
}
