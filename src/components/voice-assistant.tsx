"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function speechEngine() {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function VoiceAssistant({
  onTranscript,
  listeningLabel = "Listening…",
}: {
  onTranscript: (text: string) => void | Promise<void>;
  listeningLabel?: string;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    setSupported(Boolean(speechEngine()));
    return () => recRef.current?.stop();
  }, []);

  const stop = () => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  };

  const start = () => {
    const rec = speechEngine();
    if (!rec) {
      setSupported(false);
      return;
    }
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (event) => {
      const text = Array.from(event.results)
        .map((row) => row[0]?.transcript || "")
        .join(" ")
        .trim();
      if (text) {
        speak("Working.");
        void onTranscript(text);
      }
    };
    rec.onerror = () => stop();
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">
        Voice control needs Chrome or the Stockr Android app on this device.
      </p>
    );
  }

  return (
    <Button
      type="button"
      variant={listening ? "default" : "outline"}
      className="w-full"
      onClick={() => (listening ? stop() : start())}
    >
      {listening ? <Square className="mr-2 size-4" /> : <Mic className="mr-2 size-4" />}
      {listening ? listeningLabel : "Voice: transfer, use, find, return"}
    </Button>
  );
}

export { speak };
