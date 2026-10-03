"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

type SpeechResult = ArrayLike<{ transcript: string }> & { isFinal?: boolean };

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<SpeechResult> }) => void) | null;
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

function spokenTranscript(results: ArrayLike<SpeechResult>) {
  return Array.from(results)
    .map((row) => row[0]?.transcript || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function VoiceAssistant({
  onTranscript,
  listeningLabel = "Listening… tap when done",
}: {
  onTranscript: (text: string) => void | Promise<void>;
  listeningLabel?: string;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRec | null>(null);
  const spokenRef = useRef("");
  const submittedRef = useRef(false);

  useEffect(() => {
    queueMicrotask(() => setSupported(Boolean(speechEngine())));
    return () => recRef.current?.stop();
  }, []);

  const submit = (text: string) => {
    const spoken = text.trim();
    if (!spoken || submittedRef.current) return;
    submittedRef.current = true;
    speak("Working.");
    void onTranscript(spoken);
  };

  const stop = () => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
    submit(spokenRef.current);
  };

  const start = () => {
    const rec = speechEngine();
    if (!rec) {
      setSupported(false);
      return;
    }
    spokenRef.current = "";
    submittedRef.current = false;
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (event) => {
      const text = spokenTranscript(event.results);
      if (text) spokenRef.current = text;
    };
    rec.onerror = () => {
      recRef.current = null;
      setListening(false);
      submit(spokenRef.current);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      submit(spokenRef.current);
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">
        Voice control needs Chrome or the Stockr Android app on this device. You can still type the command below.
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
      {listening ? listeningLabel : "Voice: add, transfer, use, receive"}
    </Button>
  );
}

export { speak };
