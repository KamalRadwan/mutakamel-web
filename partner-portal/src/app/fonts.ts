import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";

// One superfamily across scripts. Identical to the tenant and admin portals —
// the same three faces at the same three weights, so a screen built here and a
// screen built there set type the same way. Plex Sans Arabic was drawn
// against Plex Latin by the same team, so mixed-script lines (a status badge's
// Latin enum value inside an Arabic sentence) don't jump baseline or x-height.
// Only 400/500/600 are downloaded — the 3-weight policy is enforced
// physically, not just by convention, because a heavier className has no 700
// weight to synthesize (font-synthesis-weight: none in globals.css blocks
// faking it too).

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
//     or person named with an accented character still renders in Plex rather
//     than dropping to a system sans mid-word.
//   - Which weights a screen needs depends on the screen.
//
// Preloading anyway costs a wasted download per face and makes the browser
// warn "preloaded with link preload was not used within a few seconds" on
// every page load — the browser reporting exactly that broken promise.
// `display: swap` keeps text visible while a face arrives.
export const plexLatin = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-latin",
  display: "swap",
  preload: false,
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-arabic",
  display: "swap",
  preload: false,
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
  preload: false,
});
