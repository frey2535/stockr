"use client";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: "#0b1f3a", color: "#f8fafc", fontFamily: "sans-serif", padding: 32 }}>
        <h1>Stockr hit an unexpected error</h1>
        <p>{error.message || "Reload and try again."}</p>
        <button
          type="button"
          onClick={() => retry()}
          style={{
            marginTop: 24,
            border: 0,
            borderRadius: 8,
            background: "#f59e0b",
            color: "#0b1f3a",
            fontWeight: 600,
            padding: "10px 16px",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
