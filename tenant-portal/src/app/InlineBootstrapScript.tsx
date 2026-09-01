"use client";

interface InlineBootstrapScriptProps {
  nonce?: string;
  html: string;
}

/**
 * The executable server tag runs during HTML parsing, before first paint. On
 * client renders it becomes inert so React never tries to execute a script
 * created during Fast Refresh or client reconciliation.
 */
export function InlineBootstrapScript({
  nonce,
  html,
}: InlineBootstrapScriptProps) {
  return (
    <script
      id="theme-bootstrap"
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
