"use client";
import { useEffect, useRef, useState } from "react";
import type { EditorDocument } from "../../template-editor-model";
import type { PageController } from "../page-controller";
import { formatPage, pageBodySize, updatePageSetup } from "../page-commands";
import { clonePageValue, type PageConfig } from "../page-contract";
import { usePageFormEligibility } from "./usePageFormEligibility";

export function usePageSetup(controller: PageController, base: EditorDocument, initial: PageConfig, pageId: string | undefined, close: () => void, basicSetupOnly: boolean) {
  const [page, setPage] = useState(() => clonePageValue(initial));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState<string[]>([]);
  const summary = useRef<HTMLDivElement>(null);
  const { editable, canMutate, guard, finishApply, failure } = usePageFormEligibility(controller, base);
  useEffect(() => { if (invalid.length) summary.current?.focus(); }, [invalid]);
  const numeric = (key: string, value: number) => fields[key] ?? String(value);
  const changeNumber = guard((key: string, value: string) => { setFields(current => ({ ...current, [key]: value })); setInvalid(current => current.filter(field => field !== key)); });
  const apply = () => {
    if (!canMutate()) return;
    const next = clonePageValue(page), errors: string[] = [];
    const read = (key: string, value: number, min: number, max: number) => {
      const text = numeric(key, value), number = text.trim() ? Number(text) : NaN;
      if (!Number.isFinite(number) || number < min || number > max) errors.push(key);
      return number;
    };
    next.widthMm = read("width", page.widthMm, 50, 500); next.heightMm = read("height", page.heightMm, 50, 1000);
    for (const edge of ["top", "end", "bottom", "start"] as const) next.marginMm[edge] = read(edge, page.marginMm[edge], 0, 100);
    const background = next.background;
    if (!basicSetupOnly && background && typeof background === "object" && "kind" in background && background.kind === "ASSET") {
      next.background = { ...background, opacity: read("opacity", Number((background as Record<string, unknown>).opacity), 0, 1) };
    }
    setInvalid(errors);
    if (errors.length) return;
    const changed = controller.setPageSetup(next, base, pageId);
    finishApply(changed, () => JSON.stringify(updatePageSetup(base, next, pageId)) === JSON.stringify(base), close);
  };
  const format = guard((preset: "A4" | "A5" | "LETTER" | "CUSTOM", orientation: "PORTRAIT" | "LANDSCAPE") => {
    const preserveCustomDimensions = basicSetupOnly && page.preset === "CUSTOM" && preset === "CUSTOM";
    const widthMm = Number(numeric("width", page.widthMm));
    const heightMm = Number(numeric("height", page.heightMm));
    const useTypedDimensions = preserveCustomDimensions && widthMm > 0 && heightMm > 0 && Number.isFinite(widthMm) && Number.isFinite(heightMm);
    setPage(current => formatPage(useTypedDimensions ? { ...current, widthMm, heightMm } : current, preset, orientation));
    if (preserveCustomDimensions && !useTypedDimensions) return;
    setFields(current => { const next = { ...current }; delete next.width; delete next.height; return next; });
    setInvalid(current => current.filter(key => key !== "width" && key !== "height"));
  });
  const original = initial.background;
  const originalAsset = original && typeof original === "object" && "kind" in original && original.kind === "ASSET" ? original : null;
  const background = page.background;
  const backgroundKind = background && typeof background === "object" && "kind" in background ? String(background.kind) : "NONE";
  const changeBackground = guard((kind: string) => setPage(current => {
    const next = { ...current };
    if (kind === "NONE") delete next.background;
    else if (kind === "SOLID") next.background = { kind, color: "#ffffff" };
    else if (kind === "ASSET" && originalAsset) next.background = clonePageValue(originalAsset);
    return next;
  }));
  const changeColor = guard((color: string) => setPage(current => ({ ...current, background: { kind: "SOLID", color } })));
  const changeFit = guard((fit: string) => setPage(current => ({ ...current, background: { ...(current.background as Record<string, unknown>), fit } })));
  const asset = backgroundKind === "ASSET" ? background as Record<string, unknown> : null;
  const color = backgroundKind === "SOLID" ? background as Record<string, unknown> : null;
  const preview = clonePageValue(page);
  const parsed = (key: string, value: number) => { const text = numeric(key, value); return text.trim() ? Number(text) : NaN; };
  preview.widthMm = parsed("width", page.widthMm); preview.heightMm = parsed("height", page.heightMm);
  for (const edge of ["top", "end", "bottom", "start"] as const) preview.marginMm[edge] = parsed(edge, page.marginMm[edge]);
  return { editable, page, preview, numeric, changeNumber, invalid, summary, apply, format, body: pageBodySize(base, preview), commandError: failure,
    originalAsset, backgroundKind, changeBackground, changeColor, changeFit,
    backgroundColor: String(color?.color ?? "#ffffff"), assetId: String(asset?.assetId ?? ""), assetFit: String(asset?.fit ?? "CONTAIN"), assetOpacity: Number(asset?.opacity ?? 1) };
}
