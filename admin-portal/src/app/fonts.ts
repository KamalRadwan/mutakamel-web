import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";

// One superfamily across scripts (docs/design-system/typography.md): Plex
// Sans Arabic was drawn against Plex Latin by the same team, so mixed-script
// lines (a status badge's Latin enum value inside an Arabic sentence) don't
// jump baseline or x-height. Only 400/500/600 are downloaded — the 3-weight
// policy is enforced physically, not just by convention, because a stray
// font-bold has no 700 weight to synthesize (font-synthesis-weight: none in
// globals.css blocks faking it too).

export const plexLatin = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-latin",
  display: "swap",
  preload: true,
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-arabic",
  display: "swap",
  preload: true,
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
  preload: false,
});
