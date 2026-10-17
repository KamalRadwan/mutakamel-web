// Theme-adaptive colorful surface palettes built on the 11 `--swatch-*`
// CSS custom properties and semantic status/priority roles in `globals.css`.
//
// Why this module exists:
// 1. Tailwind v4 extracts utility classes statically from source text. Dynamic
//    string interpolation would generate no CSS. Every swatch utility is
//    written out explicitly below so the compiler always emits it.
// 2. `--swatch-*` tokens are calibrated separately in `:root` (L 0.50–0.60 on
//    white) and `.dark` (L 0.70–0.78 on dark card surfaces) to guarantee >= 3:1
//    graphical contrast and crisp legibility in both themes without collapsing
//    distinct categories onto the four outcome ramps.
// 3. Every surface role pairs color with an icon and text label so hue reinforces
//    recognition across activity types, entity badges, and segmented pickers
//    without ever acting as the sole carrier of meaning.

export const SWATCH_HUES = [
  "red",
  "orange",
  "amber",
  "yellow",
  "green",
  "teal",
  "blue",
  "indigo",
  "purple",
  "pink",
  "slate",
] as const;

export type SwatchHue = (typeof SWATCH_HUES)[number];

export interface SwatchSurfacePalette {
  /** Active interactive tile in a category/type grid (tinted fill + border + ring). */
  tileActive: string;
  /** Idle interactive tile in a category/type grid with subtle tinted hover. */
  tileIdle: string;
  /** Solid swatch-filled icon container for active/selected states. */
  iconBoxActive: string;
  /** Tinted 15% swatch icon container with 25% border for lists, cards, and headers. */
  iconBoxIdle: string;
  /** Standalone icon or accent label text class. */
  iconText: string;
  /** Tinted category/entity badge (`border /30` + `bg /15` + `text-swatch-*`). */
  badge: string;
  /** Selected segmented pill in a pill track (`border` + `bg /15` + `text` + `ring /20`). */
  pillActive: string;
  /** Logical inline-start 4px accent border (`border-s-swatch-*`). */
  accentBorder: string;
  /** Tinted callout/section card (`border /25` + `bg /5`). */
  sectionCard: string;
  /** 6px–8px solid indicator dot (`bg-swatch-*`). */
  dot: string;
}

export const SWATCH_SURFACE_PALETTES: Record<SwatchHue, SwatchSurfacePalette> = {
  red: {
    tileActive: "border-swatch-red bg-swatch-red-soft/70 text-swatch-red-deep ring-2 ring-swatch-red/20",
    tileIdle: "border-border bg-card text-foreground hover:border-swatch-red/40 hover:bg-swatch-red-soft/40",
    iconBoxActive: "border-transparent bg-swatch-red text-primary-foreground shadow-xs",
    iconBoxIdle: "border-transparent bg-swatch-red-soft text-swatch-red-deep",
    iconText: "text-swatch-red-deep",
    badge: "border-swatch-red/30 bg-swatch-red-soft text-swatch-red-deep",
    pillActive: "border-swatch-red/45 bg-card text-swatch-red-deep shadow-2xs",
    accentBorder: "border-s-swatch-red",
    sectionCard: "border-swatch-red/25 bg-swatch-red-soft/45",
    dot: "bg-swatch-red",
  },
  orange: {
    tileActive: "border-swatch-orange bg-swatch-orange-soft/70 text-swatch-orange-deep ring-2 ring-swatch-orange/20",
    tileIdle: "border-border bg-card text-foreground hover:border-swatch-orange/40 hover:bg-swatch-orange-soft/40",
    iconBoxActive: "border-transparent bg-swatch-orange text-primary-foreground shadow-xs",
    iconBoxIdle: "border-transparent bg-swatch-orange-soft text-swatch-orange-deep",
    iconText: "text-swatch-orange-deep",
    badge: "border-swatch-orange/30 bg-swatch-orange-soft text-swatch-orange-deep",
    pillActive: "border-swatch-orange/45 bg-card text-swatch-orange-deep shadow-2xs",
    accentBorder: "border-s-swatch-orange",
    sectionCard: "border-swatch-orange/25 bg-swatch-orange-soft/45",
    dot: "bg-swatch-orange",
  },
  amber: {
    tileActive: "border-swatch-amber bg-swatch-amber-soft/70 text-swatch-amber-deep ring-2 ring-swatch-amber/20",
    tileIdle: "border-border bg-card text-foreground hover:border-swatch-amber/40 hover:bg-swatch-amber-soft/40",
    iconBoxActive: "border-transparent bg-swatch-amber text-primary-foreground shadow-xs",
    iconBoxIdle: "border-transparent bg-swatch-amber-soft text-swatch-amber-deep",
    iconText: "text-swatch-amber-deep",
    badge: "border-swatch-amber/30 bg-swatch-amber-soft text-swatch-amber-deep",
    pillActive: "border-swatch-amber/45 bg-card text-swatch-amber-deep shadow-2xs",
    accentBorder: "border-s-swatch-amber",
    sectionCard: "border-swatch-amber/25 bg-swatch-amber-soft/45",
    dot: "bg-swatch-amber",
  },
  yellow: {
    tileActive: "border-swatch-yellow bg-swatch-yellow-soft/70 text-swatch-yellow-deep ring-2 ring-swatch-yellow/20",
    tileIdle: "border-border bg-card text-foreground hover:border-swatch-yellow/40 hover:bg-swatch-yellow-soft/40",
    iconBoxActive: "border-transparent bg-swatch-yellow text-primary-foreground shadow-xs",
    iconBoxIdle: "border-transparent bg-swatch-yellow-soft text-swatch-yellow-deep",
    iconText: "text-swatch-yellow-deep",
    badge: "border-swatch-yellow/30 bg-swatch-yellow-soft text-swatch-yellow-deep",
    pillActive: "border-swatch-yellow/45 bg-card text-swatch-yellow-deep shadow-2xs",
    accentBorder: "border-s-swatch-yellow",
    sectionCard: "border-swatch-yellow/25 bg-swatch-yellow-soft/45",
    dot: "bg-swatch-yellow",
  },
  green: {
    tileActive: "border-swatch-green bg-swatch-green-soft/70 text-swatch-green-deep ring-2 ring-swatch-green/20",
    tileIdle: "border-border bg-card text-foreground hover:border-swatch-green/40 hover:bg-swatch-green-soft/40",
    iconBoxActive: "border-transparent bg-swatch-green text-primary-foreground shadow-xs",
    iconBoxIdle: "border-transparent bg-swatch-green-soft text-swatch-green-deep",
    iconText: "text-swatch-green-deep",
    badge: "border-swatch-green/30 bg-swatch-green-soft text-swatch-green-deep",
    pillActive: "border-swatch-green/45 bg-card text-swatch-green-deep shadow-2xs",
    accentBorder: "border-s-swatch-green",
    sectionCard: "border-swatch-green/25 bg-swatch-green-soft/45",
    dot: "bg-swatch-green",
  },
  teal: {
    tileActive: "border-swatch-teal bg-swatch-teal-soft/70 text-swatch-teal-deep ring-2 ring-swatch-teal/20",
    tileIdle: "border-border bg-card text-foreground hover:border-swatch-teal/40 hover:bg-swatch-teal-soft/40",
    iconBoxActive: "border-transparent bg-swatch-teal text-primary-foreground shadow-xs",
    iconBoxIdle: "border-transparent bg-swatch-teal-soft text-swatch-teal-deep",
    iconText: "text-swatch-teal-deep",
    badge: "border-swatch-teal/30 bg-swatch-teal-soft text-swatch-teal-deep",
    pillActive: "border-swatch-teal/45 bg-card text-swatch-teal-deep shadow-2xs",
    accentBorder: "border-s-swatch-teal",
    sectionCard: "border-swatch-teal/25 bg-swatch-teal-soft/45",
    dot: "bg-swatch-teal",
  },
  blue: {
    tileActive: "border-swatch-blue bg-swatch-blue-soft/70 text-swatch-blue-deep ring-2 ring-swatch-blue/20",
    tileIdle: "border-border bg-card text-foreground hover:border-swatch-blue/40 hover:bg-swatch-blue-soft/40",
    iconBoxActive: "border-transparent bg-swatch-blue text-primary-foreground shadow-xs",
    iconBoxIdle: "border-transparent bg-swatch-blue-soft text-swatch-blue-deep",
    iconText: "text-swatch-blue-deep",
    badge: "border-swatch-blue/30 bg-swatch-blue-soft text-swatch-blue-deep",
    pillActive: "border-swatch-blue/45 bg-card text-swatch-blue-deep shadow-2xs",
    accentBorder: "border-s-swatch-blue",
    sectionCard: "border-swatch-blue/25 bg-swatch-blue-soft/45",
    dot: "bg-swatch-blue",
  },
  indigo: {
    tileActive: "border-swatch-indigo bg-swatch-indigo-soft/70 text-swatch-indigo-deep ring-2 ring-swatch-indigo/20",
    tileIdle: "border-border bg-card text-foreground hover:border-swatch-indigo/40 hover:bg-swatch-indigo-soft/40",
    iconBoxActive: "border-transparent bg-swatch-indigo text-primary-foreground shadow-xs",
    iconBoxIdle: "border-transparent bg-swatch-indigo-soft text-swatch-indigo-deep",
    iconText: "text-swatch-indigo-deep",
    badge: "border-swatch-indigo/30 bg-swatch-indigo-soft text-swatch-indigo-deep",
    pillActive: "border-swatch-indigo/45 bg-card text-swatch-indigo-deep shadow-2xs",
    accentBorder: "border-s-swatch-indigo",
    sectionCard: "border-swatch-indigo/25 bg-swatch-indigo-soft/45",
    dot: "bg-swatch-indigo",
  },
  purple: {
    tileActive: "border-swatch-purple bg-swatch-purple-soft/70 text-swatch-purple-deep ring-2 ring-swatch-purple/20",
    tileIdle: "border-border bg-card text-foreground hover:border-swatch-purple/40 hover:bg-swatch-purple-soft/40",
    iconBoxActive: "border-transparent bg-swatch-purple text-primary-foreground shadow-xs",
    iconBoxIdle: "border-transparent bg-swatch-purple-soft text-swatch-purple-deep",
    iconText: "text-swatch-purple-deep",
    badge: "border-swatch-purple/30 bg-swatch-purple-soft text-swatch-purple-deep",
    pillActive: "border-swatch-purple/45 bg-card text-swatch-purple-deep shadow-2xs",
    accentBorder: "border-s-swatch-purple",
    sectionCard: "border-swatch-purple/25 bg-swatch-purple-soft/45",
    dot: "bg-swatch-purple",
  },
  pink: {
    tileActive: "border-swatch-pink bg-swatch-pink-soft/70 text-swatch-pink-deep ring-2 ring-swatch-pink/20",
    tileIdle: "border-border bg-card text-foreground hover:border-swatch-pink/40 hover:bg-swatch-pink-soft/40",
    iconBoxActive: "border-transparent bg-swatch-pink text-primary-foreground shadow-xs",
    iconBoxIdle: "border-transparent bg-swatch-pink-soft text-swatch-pink-deep",
    iconText: "text-swatch-pink-deep",
    badge: "border-swatch-pink/30 bg-swatch-pink-soft text-swatch-pink-deep",
    pillActive: "border-swatch-pink/45 bg-card text-swatch-pink-deep shadow-2xs",
    accentBorder: "border-s-swatch-pink",
    sectionCard: "border-swatch-pink/25 bg-swatch-pink-soft/45",
    dot: "bg-swatch-pink",
  },
  slate: {
    tileActive: "border-swatch-slate bg-swatch-slate-soft/70 text-swatch-slate-deep ring-2 ring-swatch-slate/20",
    tileIdle: "border-border bg-card text-foreground hover:border-swatch-slate/40 hover:bg-swatch-slate-soft/40",
    iconBoxActive: "border-transparent bg-swatch-slate text-primary-foreground shadow-xs",
    iconBoxIdle: "border-transparent bg-swatch-slate-soft text-swatch-slate-deep",
    iconText: "text-muted-foreground",
    badge: "border-swatch-slate/30 bg-swatch-slate-soft text-swatch-slate-deep",
    pillActive: "border-swatch-slate/40 bg-card text-swatch-slate-deep shadow-2xs",
    accentBorder: "border-s-swatch-slate",
    sectionCard: "border-swatch-slate/25 bg-swatch-slate-soft/45",
    dot: "bg-swatch-slate",
  },
};

export const FALLBACK_SWATCH_SURFACE_PALETTE: SwatchSurfacePalette = {
  tileActive: "border-primary bg-selected text-selected-foreground ring-2 ring-ring/20",
  tileIdle: "border-border bg-card text-foreground hover:bg-muted/60",
  iconBoxActive: "border-transparent bg-primary text-primary-foreground shadow-xs",
  iconBoxIdle: "border-transparent bg-muted text-muted-foreground",
  iconText: "text-muted-foreground",
  badge: "border-border bg-muted text-foreground",
  pillActive: "border-primary/45 bg-card text-selected-foreground shadow-2xs",
  accentBorder: "border-s-primary",
  sectionCard: "border-border bg-muted/30",
  dot: "bg-primary",
};

export function isSwatchHue(value: unknown): value is SwatchHue {
  return SWATCH_HUES.includes(value as SwatchHue);
}

/** Resolve a swatch surface palette by hue, falling back to primary/neutral tokens. */
export function swatchSurfacePalette(hue: SwatchHue | null | undefined): SwatchSurfacePalette {
  return hue && isSwatchHue(hue) ? SWATCH_SURFACE_PALETTES[hue] : FALLBACK_SWATCH_SURFACE_PALETTE;
}

/** Shared idle classes for segmented pill controls (`Status`, `Priority`, `TargetType`). */
export const IDLE_SEGMENT_PILL_CLASSES =
  "border-transparent bg-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground";

export type SemanticSegmentTone =
  | "info"
  | "purple"
  | "warning"
  | "success"
  | "destructive"
  | "slate"
  | "primary";

/** Active/idle classes for a segmented pill backed by a semantic outcome role or swatch. */
export function semanticSegmentPillClasses(tone: SemanticSegmentTone, selected: boolean): string {
  if (!selected) return IDLE_SEGMENT_PILL_CLASSES;
  switch (tone) {
    case "info":
      return "border-info/40 bg-card text-info-subtle-foreground shadow-2xs";
    case "purple":
      return SWATCH_SURFACE_PALETTES.purple.pillActive;
    case "warning":
      return "border-warning/45 bg-card text-warning-subtle-foreground shadow-2xs";
    case "success":
      return "border-success/45 bg-card text-success-subtle-foreground shadow-2xs";
    case "destructive":
      return "border-destructive/45 bg-card text-destructive-subtle-foreground shadow-2xs";
    case "slate":
      return SWATCH_SURFACE_PALETTES.slate.pillActive;
    case "primary":
    default:
      return FALLBACK_SWATCH_SURFACE_PALETTE.pillActive;
  }
}

/** 6px–8px indicator dot class for a segmented pill backed by a semantic outcome role or swatch. */
export function semanticSegmentDotClasses(tone: SemanticSegmentTone): string {
  switch (tone) {
    case "info":
      return "bg-info-vivid";
    case "purple":
      return SWATCH_SURFACE_PALETTES.purple.dot;
    case "warning":
      return "bg-warning-vivid";
    case "success":
      return "bg-success-vivid";
    case "destructive":
      return "bg-destructive-vivid";
    case "slate":
      return SWATCH_SURFACE_PALETTES.slate.dot;
    case "primary":
    default:
      return FALLBACK_SWATCH_SURFACE_PALETTE.dot;
  }
}

/** Active/idle classes for a segmented pill backed by one of the 11 swatch hues. */
export function swatchSegmentPillClasses(hue: SwatchHue | null | undefined, selected: boolean): string {
  if (!selected) return IDLE_SEGMENT_PILL_CLASSES;
  return swatchSurfacePalette(hue).pillActive;
}
