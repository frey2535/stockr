export const PHOTO_SCAN_FORMATS = [
  "code_128",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_39",
  "itf",
  "qr_code",
  "data_matrix",
];

export function plausibleBarcode(value: string) {
  const text = value.trim();
  if (text.length < 4 || text.length > 80) return false;
  return /[A-Za-z0-9]/.test(text);
}

function loadHtmlImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read that photo."));
    image.src = src;
  });
}

function readAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(file);
  });
}

function drawScaled(source: CanvasImageSource, width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not prepare that photo.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function fileToCanvas(file: Blob, maxEdge: number) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const canvas = drawScaled(bitmap, bitmap.width, bitmap.height, maxEdge);
      bitmap.close();
      return canvas;
    } catch {
      /* iPhone HEIC and some Android camera blobs need the Image path */
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadHtmlImage(objectUrl);
    return drawScaled(image, image.naturalWidth || image.width, image.naturalHeight || image.height, maxEdge);
  } catch {
    const dataUrl = await readAsDataUrl(file);
    const image = await loadHtmlImage(dataUrl);
    return drawScaled(image, image.naturalWidth || image.width, image.naturalHeight || image.height, maxEdge);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function cloneCanvas(source: HTMLCanvasElement) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext("2d")?.drawImage(source, 0, 0);
  return canvas;
}

function contrastCanvas(source: HTMLCanvasElement) {
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const luma = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    if (luma < min) min = luma;
    if (luma > max) max = luma;
  }
  const span = Math.max(1, max - min);
  for (let i = 0; i < pixels.length; i += 4) {
    const luma = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    const value = Math.round(((luma - min) / span) * 255);
    pixels[i] = value;
    pixels[i + 1] = value;
    pixels[i + 2] = value;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function rotateCanvas(source: HTMLCanvasElement, quarterTurns: number) {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 0) return source;
  const canvas = document.createElement("canvas");
  const swap = turns % 2 === 1;
  canvas.width = swap ? source.height : source.width;
  canvas.height = swap ? source.width : source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

function centerCrop(source: HTMLCanvasElement, ratio = 0.72) {
  const width = Math.max(1, Math.round(source.width * ratio));
  const height = Math.max(1, Math.round(source.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(
    source,
    Math.round((source.width - width) / 2),
    Math.round((source.height - height) / 2),
    width,
    height,
    0,
    0,
    width,
    height,
  );
  return canvas;
}

function scaledCopy(source: HTMLCanvasElement, maxEdge: number) {
  if (Math.max(source.width, source.height) <= maxEdge) return source;
  return drawScaled(source, source.width, source.height, maxEdge);
}

async function detectNative(source: CanvasImageSource) {
  if (!("BarcodeDetector" in window)) return "";
  try {
    const Detector = (
      window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (input: CanvasImageSource) => Promise<{ rawValue: string }[]> } }
    ).BarcodeDetector;
    const detector = new Detector({ formats: PHOTO_SCAN_FORMATS });
    const codes = await detector.detect(source);
    const value = codes[0]?.rawValue?.trim() || "";
    return plausibleBarcode(value) ? value : "";
  } catch {
    return "";
  }
}

async function detectZxing(canvas: HTMLCanvasElement) {
  try {
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
    ]);
    const reader = new BrowserMultiFormatReader(hints);
    const value = reader.decodeFromCanvas(canvas).getText().trim();
    return plausibleBarcode(value) ? value : "";
  } catch {
    return "";
  }
}

export async function detectBarcodeOnCanvas(base: HTMLCanvasElement) {
  const variants: HTMLCanvasElement[] = [
    scaledCopy(base, 1200),
    contrastCanvas(scaledCopy(base, 1200)),
    scaledCopy(base, 800),
    scaledCopy(base, 1600),
    centerCrop(base),
    rotateCanvas(scaledCopy(base, 1200), 1),
    rotateCanvas(scaledCopy(base, 1200), 3),
    rotateCanvas(contrastCanvas(scaledCopy(base, 1200)), 1),
  ];

  for (const variant of variants) {
    const native = await detectNative(variant);
    if (native) return native;
  }
  for (const variant of variants.slice(0, 5)) {
    const zxing = await detectZxing(variant);
    if (zxing) return zxing;
  }
  return "";
}

export async function prepareCameraPhoto(file: Blob) {
  const canvas = await fileToCanvas(file, 1600);
  const barcode = await detectBarcodeOnCanvas(canvas);
  return {
    barcode,
    imageDataUrl: canvas.toDataURL("image/jpeg", 0.9),
  };
}
