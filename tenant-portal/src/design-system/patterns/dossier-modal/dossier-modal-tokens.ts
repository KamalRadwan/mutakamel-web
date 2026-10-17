// Dossier 360° Quick-Edit Modal Design System Tokens & Surface Classes.
//
// Codifies the approved 8-case colorful Dossier Modal palette (Light + Dark mode)
// in `src/app/globals.css` (Section 9) so that CRM Lead 360° Dossier and future
// entity quick-edit modals share exact hex/OKLCH shades, gradients, card top-accents,
// KPI counter pills, split country-code + phone editors, and dark-mode surfaces.

import type { CardColor } from "../../views/card-color";

export const DOSSIER_CARD_TONES = [
  "indigo",
  "violet",
  "emerald",
  "amber",
  "cyan",
] as const;

export type DossierCardTone = (typeof DOSSIER_CARD_TONES)[number];

export const DOSSIER_KPI_KINDS = [
  "opportunities",
  "quotations",
  "salesOrders",
  "invoices",
] as const;

export type DossierKpiKind = (typeof DOSSIER_KPI_KINDS)[number];

/** Exact hex & gradient tokens for Light and Dark mode Dossier surfaces. */
export const DOSSIER_COLOR_PALETTE = {
  light: {
    modalBg: "#ffffff",
    modalBorder: "#cbd5e1",
    bodyBg: "#f1f5f9",
    cardBg: "#ffffff",
    cardBorder: "#e2e8f0",
    fieldBoxBg: "#f8fafc",
    fieldBoxBorder: "#e2e8f0",
    labelText: "#64748b",
    valueText: "#0f172a",
    phoneViewGradient: "linear-gradient(135deg, #f0fdf4 0%, #ecfeff 100%)",
    phoneViewBorder: "#a7f3d0",
    phoneEditGradient: "linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)",
    phoneEditBorder: "#6366f1",
    customFieldsGradient: "linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)",
    customFieldsBorder: "#d8b4fe",
    avatarCorporateGradient: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
    avatarIndividualGradient: "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
    avatarConvertedGradient: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
  },
  dark: {
    modalBg: "#0f172a",
    modalBorder: "#1e293b",
    bodyBg: "#090d16",
    cardBg: "#111827",
    cardBorder: "#1f2937",
    fieldBoxBg: "#1e293b",
    fieldBoxBorder: "#334155",
    labelText: "#94a3b8",
    valueText: "#f8fafc",
    phoneViewGradient:
      "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.12) 100%)",
    phoneViewBorder: "rgba(16, 185, 129, 0.35)",
    phoneEditGradient:
      "linear-gradient(135deg, rgba(79, 70, 229, 0.18) 0%, rgba(124, 58, 237, 0.18) 100%)",
    phoneEditBorder: "#818cf8",
    customFieldsGradient:
      "linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(79, 70, 229, 0.15) 100%)",
    customFieldsBorder: "rgba(167, 139, 250, 0.4)",
    avatarCorporateGradient: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
    avatarIndividualGradient: "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
    avatarConvertedGradient: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
  },
} as const;

/** Card top-border and icon pill classes per Dossier card tone. */
export const DOSSIER_CARD_TONE_CLASSES: Record<
  DossierCardTone,
  {
    card: string;
    cardEditing: string;
    headerEditing: string;
    iconPill: string;
    actionButton: string;
  }
> = {
  indigo: {
    card: "dossier-card dossier-card-indigo",
    cardEditing: "dossier-card dossier-card-editing",
    headerEditing: "dossier-card-header dossier-card-header-editing-indigo",
    iconPill: "dossier-icon-pill dossier-ip-indigo",
    actionButton: "dossier-btn-action",
  },
  violet: {
    card: "dossier-card dossier-card-violet",
    cardEditing: "dossier-card dossier-card-editing-violet",
    headerEditing: "dossier-card-header dossier-card-header-editing-violet",
    iconPill: "dossier-icon-pill dossier-ip-violet",
    actionButton: "dossier-btn-action dossier-btn-action-violet",
  },
  emerald: {
    card: "dossier-card dossier-card-emerald",
    cardEditing: "dossier-card dossier-card-editing",
    headerEditing: "dossier-card-header",
    iconPill: "dossier-icon-pill dossier-ip-emerald",
    actionButton: "dossier-btn-action dossier-btn-action-emerald",
  },
  amber: {
    card: "dossier-card dossier-card-amber",
    cardEditing: "dossier-card dossier-card-editing",
    headerEditing: "dossier-card-header",
    iconPill: "dossier-icon-pill dossier-ip-amber",
    actionButton: "dossier-btn-action",
  },
  cyan: {
    card: "dossier-card dossier-card-cyan",
    cardEditing: "dossier-card dossier-card-editing-cyan",
    headerEditing: "dossier-card-header dossier-card-header-editing-cyan",
    iconPill: "dossier-icon-pill dossier-ip-cyan",
    actionButton: "dossier-btn-action dossier-btn-action-cyan",
  },
};

/** KPI counter pill classes in the Dossier header. */
export const DOSSIER_KPI_PILL_CLASSES: Record<DossierKpiKind, string> = {
  opportunities: "dossier-kpi-pill dossier-kpi-opp",
  quotations: "dossier-kpi-pill dossier-kpi-quo",
  salesOrders: "dossier-kpi-pill dossier-kpi-ord",
  invoices: "dossier-kpi-pill dossier-kpi-inv",
};

/** Board card color picker options displayed in the Dossier header ("None" / No Color first). */
export const DOSSIER_HEADER_CARD_COLORS: ReadonlyArray<{
  color: CardColor | null;
  hex: string;
  labelEn: string;
  labelAr: string;
}> = [
  { color: null, hex: "transparent", labelEn: "None", labelAr: "بدون لون" },
  { color: "BLUE", hex: "#3b82f6", labelEn: "Blue", labelAr: "أزرق" },
  { color: "GREEN", hex: "#10b981", labelEn: "Emerald", labelAr: "أخضر" },
  { color: "AMBER", hex: "#f59e0b", labelEn: "Amber", labelAr: "كهرماني" },
  { color: "RED", hex: "#f43f5e", labelEn: "Rose", labelAr: "وردي" },
  { color: "PURPLE", hex: "#8b5cf6", labelEn: "Violet", labelAr: "بنفسجي" },
] as const;

/** Tag pill color classes cycled across lead tags when custom colors are not set. */
export const DOSSIER_TAG_TONE_CLASSES = [
  "dossier-tag dossier-tag-purple",
  "dossier-tag dossier-tag-rose",
  "dossier-tag dossier-tag-emerald",
  "dossier-tag dossier-tag-amber",
] as const;

export function dossierAvatarClass(
  isCorporate: boolean,
  isConverted: boolean,
): string {
  if (isConverted) return "dossier-avatar-box dossier-avatar-conv";
  return isCorporate
    ? "dossier-avatar-box dossier-avatar-corp"
    : "dossier-avatar-box dossier-avatar-indiv";
}

export function dossierStatusBadgeClass(status: string): string {
  switch (status) {
    case "CONVERTED":
      return "dossier-badge dossier-badge-status-conv";
    case "ON_HOLD":
      return "dossier-badge dossier-badge-status-hold";
    case "DISQUALIFIED":
      return "dossier-badge dossier-badge-status-disq";
    case "OPEN":
    default:
      return "dossier-badge dossier-badge-status-open";
  }
}

export function dossierStageCellClass(params: {
  flag: string;
  isCurrent: boolean;
  isPast: boolean;
}): string {
  const { flag, isCurrent, isPast } = params;
  if (flag === "CONVERTED" && isCurrent) {
    return "dossier-stage-cell conv-active";
  }
  if (flag === "DISQUALIFIED" && isCurrent) {
    return "dossier-stage-cell disq-active";
  }
  if (isCurrent) {
    return "dossier-stage-cell current";
  }
  if (flag === "DISQUALIFIED") {
    return "dossier-stage-cell disq";
  }
  if (flag === "CONVERTED") {
    return "dossier-stage-cell conv";
  }
  if (isPast) {
    return "dossier-stage-cell past";
  }
  return "dossier-stage-cell";
}
