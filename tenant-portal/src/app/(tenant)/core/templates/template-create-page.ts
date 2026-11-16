// Core CreateTemplatePageDto and TemplatePlatformService.assertCreatePage /
// pageDimensions own these geometry limits. These are millimetres, not money.
export const TEMPLATE_PAGE_PRESETS = ["A4", "A5", "LETTER", "CUSTOM"] as const;
export const TEMPLATE_PAGE_ORIENTATIONS = ["PORTRAIT", "LANDSCAPE"] as const;
export interface TemplateCreatePageValues {
  preset: (typeof TEMPLATE_PAGE_PRESETS)[number]; orientation: (typeof TEMPLATE_PAGE_ORIENTATIONS)[number];
  widthMm: string; heightMm: string; top: string; end: string; bottom: string; start: string;
}
// Used for blank creation or when discovery supplies no starter page.
export const DEFAULT_TEMPLATE_PAGE: TemplateCreatePageValues = { preset: "A4", orientation: "PORTRAIT", widthMm: "210", heightMm: "297", top: "15", end: "15", bottom: "15", start: "15" };
export const templateCreatePageCopy = {
  en: {
    pagePreset: "Page size", pageOrientation: "Page orientation", pageWidth: "Custom width (mm)", pageHeight: "Custom height (mm)",
    top: "Top margin (mm)", end: "End margin (mm)", bottom: "Bottom margin (mm)", start: "Start margin (mm)",
    printableArea: "Printable area",
    pageInvalid: "Enter valid page dimensions and margins that leave a positive printable area.",
    A4: "A4", A5: "A5", LETTER: "US Letter", CUSTOM: "Custom", PORTRAIT: "Portrait", LANDSCAPE: "Landscape",
  },
  ar: {
    pagePreset: "مقاس الصفحة", pageOrientation: "اتجاه الصفحة", pageWidth: "العرض المخصص (مم)", pageHeight: "الارتفاع المخصص (مم)",
    top: "الهامش العلوي (مم)", end: "هامش النهاية (مم)", bottom: "الهامش السفلي (مم)", start: "هامش البداية (مم)",
    printableArea: "المساحة القابلة للطباعة",
    pageInvalid: "أدخل أبعادًا وهوامش صالحة تترك مساحة موجبة للطباعة.",
    A4: "A4", A5: "A5", LETTER: "ليتر أمريكي", CUSTOM: "مخصص", PORTRAIT: "عمودي", LANDSCAPE: "أفقي",
  },
};
export type TemplateCreatePage = {
  orientation: TemplateCreatePageValues["orientation"];
  marginMm: { top: number; end: number; bottom: number; start: number };
} & ({ preset: "CUSTOM"; widthMm: number; heightMm: number } |
  { preset: "A4" | "A5" | "LETTER"; widthMm?: never; heightMm?: never });

export type TemplateStarterPage = Extract<TemplateCreatePage, { preset: "A4" | "A5" | "LETTER" }>;

export function templateStarterPageValues(page: TemplateStarterPage): TemplateCreatePageValues {
  return { ...DEFAULT_TEMPLATE_PAGE, preset: page.preset, orientation: page.orientation,
    top: String(page.marginMm.top), end: String(page.marginMm.end), bottom: String(page.marginMm.bottom), start: String(page.marginMm.start) };
}
export function templateCreatePage(values: TemplateCreatePageValues): TemplateCreatePage | null {
  return resolveTemplateCreatePage(values)?.page ?? null;
}

export function resolveTemplateCreatePage(values: TemplateCreatePageValues) {
  const marginMm = { top: Number(values.top), end: Number(values.end), bottom: Number(values.bottom), start: Number(values.start) };
  if ([values.top, values.end, values.bottom, values.start].some(value => !value.trim()) ||
    Object.values(marginMm).some(value => !Number.isFinite(value) || value < 0 || value > 100)) return null;
  const dimensions = { A4: [210, 297], A5: [148, 210], LETTER: [215.9, 279.4], CUSTOM: [Number(values.widthMm), Number(values.heightMm)] }[values.preset];
  if (values.preset === "CUSTOM" && (!values.widthMm.trim() || !values.heightMm.trim() || !Number.isFinite(dimensions[0]) || !Number.isFinite(dimensions[1]) ||
    dimensions[0] < 50 || dimensions[0] > 500 || dimensions[1] < 50 || dimensions[1] > 1000)) return null;
  const [widthMm, heightMm] = values.orientation === "LANDSCAPE" ? [dimensions[1], dimensions[0]] : dimensions;
  const printableArea = {
    widthMm: widthMm - (marginMm.start + marginMm.end),
    heightMm: heightMm - (marginMm.top + marginMm.bottom),
  };
  if (printableArea.widthMm <= 0 || printableArea.heightMm <= 0) return null;
  const page: TemplateCreatePage = values.preset === "CUSTOM"
    ? { preset: "CUSTOM", orientation: values.orientation, marginMm, widthMm: dimensions[0], heightMm: dimensions[1] }
    : { preset: values.preset, orientation: values.orientation, marginMm };
  return { page, printableArea };
}
