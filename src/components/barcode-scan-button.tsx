"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Detector = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

export function BarcodeScanButton({
  onCode,
  label = "Scan barcode",
}: {
  onCode: (code: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);

  useEffect(() => {
    if (!open) {
      scanningRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }

    let cancelled = false;
    const start = async () => {
      setError("");
      if (!("BarcodeDetector" in window)) {
        setError("This browser cannot scan from the camera. Type the barcode instead.");
        return;
      }
      try {
        const Detector = (
          window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => Detector }
        ).BarcodeDetector;
        const detector = new Detector({
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
          if (!scanningRef.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              scanningRef.current = false;
              onCode(codes[0].rawValue);
              setOpen(false);
              return;
            }
          } catch {
            /* keep scanning */
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } catch {
        setError("Camera permission was denied.");
      }
    };
    void start();
    return () => {
      cancelled = true;
      scanningRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [open, onCode]);

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
        {open ? <X className="mr-2 size-4" /> : <Camera className="mr-2 size-4" />}
        {open ? "Close camera" : label}
      </Button>
      {open ? (
        <div className="overflow-hidden rounded-xl border bg-black">
          <video ref={videoRef} className="h-40 w-full object-cover" muted playsInline />
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
