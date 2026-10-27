import { Cairo, IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";

// Ocean Navy v3 (2026-10-26): Plus Jakarta Sans carries Latin runs and Cairo
// carries Arabic runs across weights 400–800; IBM Plex Mono stays for machine
// identifiers. Family-neutral export and CSS variable names keep the root
// layout and global error boundary independent of the selected typefaces.
//
// `Cairo` includes `"latin"` alongside `"arabic"` so elements that explicitly
// opt into `font-arabic` still render Western digits and punctuation in Cairo
// without falling through to a system sans mid-label.

// Nothing is preloaded, and that is deliberate.
//
// A preload is a promise that a file is needed for the first paint. This app
// cannot make that promise about any of these faces:
//
//   - The language lives in localStorage, so the server always renders
//     lang="ar" and the client corrects it after hydration. Every Arabic
//     preload the server emits is wasted on an English operator, and the
//     other way round.
//   - `latin-ext` carries no glyph this UI draws. It is declared so a tenant
//     or person named with an accented character still renders in Jakarta
//     rather than dropping to a system sans mid-word.
//   - Which weights a screen needs depends on the screen. The audit log draws
//     51 monospace elements; other screens draw none.
//
// Preloading anyway costs a wasted download per face and makes the browser
// warn "preloaded with link preload was not used within a few seconds" on
// every page load — the browser reporting exactly that broken promise.
// `display: swap` keeps text visible while a face arrives.
export const uiLatin = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-ui-latin",
  display: "swap",
  preload: false,
});

export const uiArabic = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-ui-arabic",
  display: "swap",
  preload: false,
});

export const uiMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ui-mono",
  display: "swap",
  preload: false,
});
