import { NextResponse } from "next/server";
import { identifyRemoteProduct, searchRemoteProduct } from "@/lib/barcode-lookup";
import { fillIdentityFromCatalog, isCompleteIdentity, resolvePhotoIdentities } from "@/lib/identify-photo";
import { materialMatchesCode } from "@/lib/inventory";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { requireAccount } from "@/lib/require-account";
import { canUseVision, completeProductIdentity, detectObjectsFromVision } from "@/lib/vision-identify";
import { lookupMaterials } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { account, response } = await requireAccount();
  if (!account) return response;
  const limited = await rateLimit(clientKey(request, `vision:${account.company.id}`), 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Photo ID limit reached for this hour. Try again later." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { image?: string; barcode?: string; barcodes?: string[] } | null;
  const barcodes = Array.from(
    new Set([body?.barcode, ...(Array.isArray(body?.barcodes) ? body.barcodes : [])].map((value) => String(value || "").trim()).filter(Boolean)),
  );
  const image = String(body?.image || "");
  const vision = image.startsWith("data:image") ? await detectObjectsFromVision(image) : { objects: [] as Awaited<ReturnType<typeof detectObjectsFromVision>>["objects"] };
  const items = await resolvePhotoIdentities(
    vision.objects,
    barcodes,
    identifyRemoteProduct,
    searchRemoteProduct,
    completeProductIdentity,
  );

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
    error,
  });
}
