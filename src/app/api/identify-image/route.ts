import { NextResponse } from "next/server";
import { identifyRemoteProduct, searchRemoteProduct } from "@/lib/barcode-lookup";
import { identityGaps, isCompleteIdentity, resolvePhotoIdentities } from "@/lib/identify-photo";
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

  const first = items[0];
  const catalogQuery =
    first?.identified?.barcode ||
    first?.draft.barcode ||
    barcodes[0] ||
    first?.identified?.name ||
    first?.draft.name ||
    "";
  const catalog = catalogQuery
    ? await lookupMaterials(account.company.id, { barcode: catalogQuery, q: catalogQuery, limit: 8 })
    : { rows: [], onHandByLocation: {} };
  const rows = (catalog.rows || []).filter(
    (row) =>
      (catalogQuery && materialMatchesCode(row, catalogQuery)) ||
      (catalogQuery && row.name.toLowerCase().includes(catalogQuery.toLowerCase())),
  );
  const catalogHit = rows[0];
  if (catalogHit && first && identityGaps(first.identified).length > 0) {
    const prior = first.identified;
    first.identified = {
      name: catalogHit.name,
      barcode: catalogHit.barcode || prior?.barcode || first.draft.barcode || "",
      mpn: catalogHit.mpn || prior?.mpn || first.draft.mpn || "",
      manufacturer: catalogHit.manufacturer || prior?.manufacturer,
      brand: catalogHit.manufacturer || prior?.brand,
      upc: catalogHit.upc || prior?.upc,
      image_url: catalogHit.image_url || prior?.image_url,
      source: "catalog",
    };
    first.draft = {
      name: first.identified.name,
      barcode: first.identified.barcode,
      mpn: first.identified.mpn || "",
      brand: first.identified.brand,
      manufacturer: first.identified.manufacturer,
      image_url: first.identified.image_url,
      source: "catalog",
    };
    first.missing = identityGaps(first.identified);
    items[0] = first;
  }
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
    onHandByLocation: catalog.onHandByLocation || {},
    error,
  });
}
