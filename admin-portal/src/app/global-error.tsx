"use client";

// Catches errors in the root layout itself (fonts, providers, globals.css
// failing to apply). Next.js requires this to render its own complete
// <html>/<body> since it fully replaces the root layout — it cannot rely on
// globals.css, the font variables, or any provider from layout.tsx.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" dir="ltr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0f172a",
          color: "#f8fafc",
        }}
      >
        <p style={{ fontSize: "0.875rem", color: "#cbd5e1" }}>
          A critical error occurred. You can try again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            borderRadius: "0.5rem",
            background: "#f8fafc",
            color: "#0f172a",
            padding: "0.5rem 1rem",
            fontSize: "0.75rem",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </body>
    </html>
  );
}
