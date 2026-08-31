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
      <head>
        <title>Page unavailable · تعذر تحميل الصفحة</title>
        <style>{`
          :root { color-scheme: light dark; }
          body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center;
            justify-content: center; gap: 1rem; box-sizing: border-box; padding: 1.5rem; text-align: center;
            font-family: system-ui, sans-serif; background: #F1F9FF; color: #10233F; }
          p { max-width: 28rem; margin: 0; font-size: 0.875rem; line-height: 1.5; color: #526B85; }
          button { min-width: 2.75rem; min-height: 2.75rem; border: 0; border-radius: 0.375rem; padding: 0.625rem 1rem;
            background: #1D4ED8; color: #FFFFFF; font: 600 0.8125rem/1 system-ui, sans-serif; cursor: pointer; }
          button:hover { background: #1E40AF; }
          button:focus-visible { outline: 3px solid #2563EB; outline-offset: 3px; }
          @media (prefers-color-scheme: dark) {
            body { background: #091219; color: #F6FAFD; }
            p { color: #AFC1D2; }
            button { background: #60A5FA; color: #091219; }
            button:hover { background: #93C5FD; }
          }
        `}</style>
      </head>
      <body>
        <h1 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
          Page unavailable · تعذر تحميل الصفحة
        </h1>
        <p>
          A critical error occurred. You can try again.
          <br />
          حدث خطأ حرج. يمكنك إعادة المحاولة.
        </p>
        <button
          type="button"
          onClick={reset}
        >
          Retry · إعادة المحاولة
        </button>
      </body>
    </html>
  );
}
