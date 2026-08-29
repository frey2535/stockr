import React, { useEffect, useRef, useState } from "react";
import { X, Keyboard, Camera, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Only UPC/EAN formats for maximum accuracy on curved/reflective surfaces
const FORMATS = ["upc_a", "upc_e", "ean_13", "ean_8", "code_128", "code_39"];

// Multi-frame voting: barcode must be seen this many times to be accepted
const CONFIRM_FRAMES = 3;

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1800;
    osc.type = "square";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch {}
}

function vibrate() {
  try { navigator.vibrate?.(120); } catch {}
}

/**
 * Apply canvas-based image enhancements to improve barcode detection on
 * curved, reflective, and glossy surfaces.
 * Returns an ImageBitmap or null on failure.
 */
function enhanceFrame(video, canvas, ctx, pass = "normal") {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  // For "zoom" pass: crop the center 60% to flatten perspective
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (pass === "zoom") {
    sx = vw * 0.2;
    sy = vh * 0.2;
    sw = vw * 0.6;
    sh = vh * 0.6;
  }

  canvas.width = sw;
  canvas.height = sh;

  // Draw the (optionally cropped) frame
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

  // Read pixel data for manual enhancement
  const imageData = ctx.getImageData(0, 0, sw, sh);
  const data = imageData.data;
  const len = data.length;

  if (pass === "contrast") {
    // High contrast pass: boost contrast aggressively, convert to grayscale
    // Good for shiny/glossy surfaces where color confuses detection
    for (let i = 0; i < len; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // Luminance
      let lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // Apply S-curve contrast boost
      lum = lum / 255;
      lum = lum < 0.5
        ? 2 * lum * lum
        : 1 - Math.pow(-2 * lum + 2, 2) / 2;
      lum = Math.min(255, Math.max(0, lum * 255 * 1.4 - 20));
      data[i] = data[i + 1] = data[i + 2] = lum;
    }
  } else if (pass === "sharpen") {
    // Sharpen pass: helps with slightly blurred/curved barcodes
    // First convert to grayscale
    for (let i = 0; i < len; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = data[i + 1] = data[i + 2] = lum;
    }
    ctx.putImageData(imageData, 0, 0);

    // Apply CSS filter sharpen via re-draw
    ctx.filter = "contrast(1.5) brightness(1.05)";
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
    return canvas;
  } else if (pass === "glare") {
    // Glare reduction: clamp highlights, boost shadows
    // Reduces washout from reflective plastic/bottle surfaces
    for (let i = 0; i < len; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2];
      // Detect likely glare (near-white pixels)
      const brightness = (r + g + b) / 3;
      if (brightness > 220) {
        // Clamp glare region to a mid-gray
        const clamp = 180;
        data[i] = clamp;
        data[i + 1] = clamp;
        data[i + 2] = clamp;
      } else {
        // Boost darker regions for better bar/space contrast
        const factor = 1.3;
        data[i] = Math.min(255, r * factor);
        data[i + 1] = Math.min(255, g * factor);
        data[i + 2] = Math.min(255, b * factor);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export default function BarcodeScanner({ open, onClose, onScan }) {
  const [manualMode, setManualMode] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [error, setError] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const activeRef = useRef(false);
  // Multi-frame vote map: barcode value → count
  const voteMapRef = useRef({});
  const frameCountRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setManualMode(false);
    setManualBarcode("");
    setScanning(false);
    setError("");
    voteMapRef.current = {};
    frameCountRef.current = 0;

    if (!("BarcodeDetector" in window)) {
      setManualMode(true);
      return;
    }

    startCamera();
    return () => stopCamera();
  }, [open]);

  const startCamera = async () => {
    activeRef.current = true;
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 3840 },
          height: { ideal: 2160 },
          focusMode: { ideal: "continuous" },
        },
      });

      if (!activeRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() || {};
      if (caps.torch) setTorchSupported(true);
      if (caps.focusMode?.includes?.("continuous")) {
        track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
        videoRef.current.oncanplay = () => {
          if (activeRef.current) { setScanning(true); initDetector(); }
        };
      }
    } catch {
      setError("Camera access denied. Use manual entry below.");
      setManualMode(true);
    }
  };

  const initDetector = async () => {
    try {
      let formats = FORMATS;
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        if (supported?.length) formats = FORMATS.filter(f => supported.includes(f));
      } catch {}
      detectorRef.current = new window.BarcodeDetector({ formats });
      scanLoop();
    } catch {
      setManualMode(true);
    }
  };

  /**
   * Multi-pass scan loop:
   * Each animation frame we try up to 4 enhanced versions of the image.
   * A barcode must be confirmed CONFIRM_FRAMES times before accepting.
   */
  const scanLoop = async () => {
    if (!activeRef.current || !videoRef.current || !detectorRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas || video.readyState < video.HAVE_ENOUGH_DATA || !video.videoWidth) {
      if (activeRef.current) rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    frameCountRef.current++;

    // Alternate enhancement passes each frame to spread CPU cost
    const pass = ["normal", "contrast", "glare", "zoom", "sharpen"][frameCountRef.current % 5];

    try {
      const source = enhanceFrame(video, canvas, ctx, pass) || video;
      const results = await detectorRef.current.detect(source);

      if (results.length > 0) {
        const value = results[0].rawValue?.trim();
        if (value) {
          voteMapRef.current[value] = (voteMapRef.current[value] || 0) + 1;

          // Confirm after CONFIRM_FRAMES consistent reads
          if (voteMapRef.current[value] >= CONFIRM_FRAMES) {
            activeRef.current = false;
            cancelAnimationFrame(rafRef.current);
            stopCamera();
            playBeep();
            vibrate();
            onScan(value);
            return;
          }
        }
      } else {
        // Decay votes slightly when nothing found to prevent stale confirmations
        for (const key in voteMapRef.current) {
          voteMapRef.current[key] = Math.max(0, voteMapRef.current[key] - 0.5);
        }
      }
    } catch {}

    if (activeRef.current) {
      rafRef.current = requestAnimationFrame(scanLoop);
    }
  };

  const stopCamera = () => {
    activeRef.current = false;
    setScanning(false);
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setTorchOn(false);
    setTorchSupported(false);
  };

  const toggleTorch = async () => {
    if (!streamRef.current || !torchSupported) return;
    const track = streamRef.current.getVideoTracks()[0];
    const next = !torchOn;
    try { await track.applyConstraints({ advanced: [{ torch: next }] }); setTorchOn(next); } catch {}
  };

  const handleClose = () => { stopCamera(); setManualMode(false); setManualBarcode(""); onClose(); };
  const switchToManual = () => { stopCamera(); setManualMode(true); };
  const switchToCamera = () => { setManualMode(false); voteMapRef.current = {}; frameCountRef.current = 0; startCamera(); };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const val = manualBarcode.trim();
    if (val) { playBeep(); vibrate(); onScan(val); setManualBarcode(""); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      {/* Hidden canvas for frame processing */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Camera className="w-5 h-5 text-secondary" />
            Scan Barcode
          </h2>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!manualMode ? (
          <div>
            <div className="relative bg-black w-full" style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />

              {/* Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 right-0 bg-black/50" style={{ height: "31%" }} />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50" style={{ height: "31%" }} />
                <div className="absolute left-0 bg-black/50" style={{ top: "31%", bottom: "31%", width: "7.5%" }} />
                <div className="absolute right-0 bg-black/50" style={{ top: "31%", bottom: "31%", width: "7.5%" }} />

                <div className="absolute" style={{
                  top: "31%", left: "7.5%", right: "7.5%", bottom: "31%",
                  border: `2px solid ${scanning ? "#22c55e" : "#f97316"}`,
                  borderRadius: 6,
                  boxShadow: scanning ? "0 0 12px rgba(34,197,94,0.4)" : "0 0 12px rgba(249,115,22,0.3)",
                  transition: "border-color 0.3s, box-shadow 0.3s",
                }}>
                  <div style={{
                    position: "absolute", left: 4, right: 4, height: 2, borderRadius: 2,
                    background: scanning ? "rgba(34,197,94,0.9)" : "rgba(249,115,22,0.7)",
                    animation: scanning ? "scanline 1.8s ease-in-out infinite" : "none",
                  }} />
                  {[{ top: -2, left: -2 }, { top: -2, right: -2 }, { bottom: -2, left: -2 }, { bottom: -2, right: -2 }].map((pos, i) => (
                    <div key={i} style={{
                      position: "absolute", width: 16, height: 16,
                      borderColor: "#f97316", borderStyle: "solid", borderWidth: 0,
                      borderTopWidth: pos.top !== undefined ? 3 : 0,
                      borderBottomWidth: pos.bottom !== undefined ? 3 : 0,
                      borderLeftWidth: pos.left !== undefined ? 3 : 0,
                      borderRightWidth: pos.right !== undefined ? 3 : 0,
                      ...pos, borderRadius: 2,
                    }} />
                  ))}
                </div>
              </div>

              <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
                <span className="text-xs font-semibold px-3 py-1 rounded-full text-white"
                  style={{ background: scanning ? "rgba(34,197,94,0.85)" : "rgba(0,0,0,0.6)" }}>
                  {scanning ? "● SCANNING" : "Starting camera..."}
                </span>
              </div>

              {torchSupported && (
                <div className="absolute bottom-3 inset-x-0 flex justify-center">
                  <button onClick={toggleTorch} className="rounded-full p-2.5 text-white transition-colors"
                    style={{ background: torchOn ? "#f97316" : "rgba(0,0,0,0.6)" }}>
                    {torchOn ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
                  </button>
                </div>
              )}
            </div>

            <style>{`
              @keyframes scanline {
                0%   { transform: translateY(0%); opacity: 0.5; }
                50%  { transform: translateY(2800%); opacity: 1; }
                100% { transform: translateY(0%); opacity: 0.5; }
              }
            `}</style>

            <div className="p-4 space-y-2">
              <p className="text-center text-sm text-muted-foreground">Hold steady — align barcode in the box</p>
              <Button variant="outline" className="w-full" onClick={switchToManual}>
                <Keyboard className="w-4 h-4 mr-2" /> Enter Manually
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <p className="text-sm text-muted-foreground text-center">Type or paste the barcode number</p>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <Input
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder="e.g. 012345678901"
                className="text-center text-lg tracking-widest h-12"
                autoFocus
                inputMode="numeric"
              />
              <div className="flex gap-2">
                {"BarcodeDetector" in window && (
                  <Button type="button" variant="outline" className="flex-1" onClick={switchToCamera}>
                    <Camera className="w-4 h-4 mr-2" /> Use Camera
                  </Button>
                )}
                <Button type="submit" className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  disabled={!manualBarcode.trim()}>
                  Look Up
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}