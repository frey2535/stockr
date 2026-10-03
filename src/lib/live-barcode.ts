import { PHOTO_SCAN_FORMATS, plausibleBarcode } from "./photo-barcode";

function videoFrame(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d", { willReadFrequently: true })?.drawImage(video, 0, 0);
  return canvas;
}

async function detectNative(source: CanvasImageSource) {
  if (!("BarcodeDetector" in window)) return [] as string[];
  try {
    const Detector = (
      window as unknown as {
        BarcodeDetector: new (opts: { formats: string[] }) => { detect: (input: CanvasImageSource) => Promise<{ rawValue: string }[]> };
      }
    ).BarcodeDetector;
    const detector = new Detector({ formats: PHOTO_SCAN_FORMATS });
    const codes = await detector.detect(source);
    return codes.map((row) => row.rawValue?.trim() || "").filter(plausibleBarcode);
  } catch {
    return [];
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
    return plausibleBarcode(value) ? [value] : [];
  } catch {
    return [];
  }
}

export async function readCodesFromVideo(video: HTMLVideoElement, allowZxing = true) {
  const native = await detectNative(video);
  if (native.length) return native;
  if (!allowZxing) return [];
  const canvas = videoFrame(video);
  return canvas ? detectZxing(canvas) : [];
}
