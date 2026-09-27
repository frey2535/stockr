import { NextResponse } from "next/server";
import { identifyRemoteProduct, searchRemoteProduct } from "@/lib/barcode-lookup";
import { isCompleteIdentity, resolvePhotoIdentities } from "@/lib/identify-photo";
import { materialMatchesCode } from "@/lib/inventory";
import { requireAccount } from "@/lib/require-account";
import { canUseVision, completeProductIdentity, detectObjectsFromVision } from "@/lib/vision-identify";
import { lookupMaterials } from "@/lib/workspace-data";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { account, response } = await requireAccount();
  if (!account) return response;
  const body = (await request.json().catch(() => null)) as { image?: string; barcode?: string; barcodes?: string[] } | null;
  const barcodes = Array.from(
    new Set([body?.barcode, ...(Array.isArray(body?.barcodes) ? body.barcodes : [])].map((value) => String(value || "").trim()).filter(Boolean)),
  );
  const image = String(body?.image || "");
  const objects = image.startsWith("data:image") ? await detectObjectsFromVision(image) : [];
  const items = await resolvePhotoIdentities(
    objects,
    barcodes,
    identifyRemoteProduct,
    searchRemoteProduct,
    completeProductIdentity,
  );

  const first = items[0];
  const catalogQuery = first?.identified?.barcode || first?.draft.barcode || barcodes[0] || "";
  const catalog = catalogQuery
    ? await lookupMaterials(account.company.id, { barcode: catalogQuery, q: catalogQuery, limit: 8 })
    : { rows: [], onHandByLocation: {} };
  const rows = (catalog.rows || []).filter((row) => catalogQuery && materialMatchesCode(row, catalogQuery));
  const identifiedCount = items.filter((item) => item.identified && isCompleteIdentity(item.identified)).length;
  const error =
    !objects.length && !identifiedCount && image.startsWith("data:image") && !(await canUseVision())
      ? "Photo ID needs a vision model. Production uses Cloudflare Workers AI — merge this update so photos can be identified."
      : !objects.length && !identifiedCount && image.startsWith("data:image")
        ? "Nothing in this photo could be identified yet. Try a closer shot of the label or barcode."
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
