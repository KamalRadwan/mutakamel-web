// @vitest-environment jsdom
import { createElement, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuotationTemplateGallery } from "./QuotationTemplateGallery";
import type { useQuotationTemplateLibrary } from "../hooks/useQuotationTemplateLibrary";
import type { QuotationTemplateChoice } from "../quotation-template-library";

const ui = vi.hoisted(() => ({ lang: "en" }));

vi.mock("@/i18n/I18nContext", async () => {
  const [{ en }, { ar }] = await Promise.all([import("@/i18n/dictionaries/en"), import("@/i18n/dictionaries/ar")]);
  return { useI18n: () => ({ lang: ui.lang, t: ui.lang === "ar" ? ar : en }) };
});
vi.mock("@/design-system", () => {
  interface Props { children?: ReactNode; open?: boolean }
  const block = ({ children }: Props) => createElement("div", null, children);
  return {
    Badge: block, DialogContent: block, DialogDescription: block, DialogTitle: block, Skeleton: block,
    Input: () => createElement("input"), Dialog: ({ open, children }: Props) => open ? createElement("div", null, children) : null,
    Button: ({ children, onClick, disabled, "aria-pressed": pressed }: ComponentPropsWithoutRef<"button">) =>
      createElement("button", { onClick, disabled, "aria-pressed": pressed }, children),
  };
});

function library(code?: string): ReturnType<typeof useQuotationTemplateLibrary> {
  return { open: true, setOpen: vi.fn(), search: "", setSearch: vi.fn(), items: [], cursor: null, loading: false,
    error: code ? { status: 403, code } : null, sample: null, sampleLoading: false, sampleError: false,
    retry: vi.fn(), more: vi.fn(), closeSample: vi.fn(), preview: vi.fn() };
}

function choice(overrides: Partial<QuotationTemplateChoice> = {}): QuotationTemplateChoice {
  const draft = { draftId: "draft-id", revision: 1, validationState: "PASSED" as const };
  return {
    templateId: "template-id", templateVersionId: "version-id", version: 1, locale: "en-US", layoutMode: "HYBRID_DOCUMENT",
    name: "Classic", canPreview: true, contentChecksum: "checksum",
    detail: {
      id: "template-id", name: "Classic", code: "SALES-001", locale: "en-US", layoutMode: "HYBRID_DOCUMENT", scope: { type: "TENANT" },
      documentType: "QUOTATION", outputChannel: "PRINT", lifecycleStatus: "ACTIVE", direction: "LTR",
      dataSourceKey: "TRADE_QUOTATION_PRINT_V1", description: null, systemProtected: false,
      draft, currentDraft: { ...draft, etag: '"1"', contentChecksum: "draft-checksum" }, currentPublishedVersion: null,
      definitionRevision: 1, definitionEtag: '"1"', etag: '"1"', createdAt: "2026-11-10", updatedAt: "2026-11-10",
    },
    ...overrides,
  };
}

describe("template gallery explicit authorization boundary", () => {
  afterEach(() => { cleanup(); ui.lang = "en"; });
  it.each([
    ["ACCESS_POLICY_BLOCKED", "The current access policy blocks this tenant's template library."],
    ["FORBIDDEN", "You cannot read the template library."],
  ])("keeps branch default available and removes retry controls for %s", (code, expected) => {
    const choose = vi.fn(); const state = library(code);
    render(<QuotationTemplateGallery library={{ ...state, sample: "<p>Previously loaded</p>" }} selected={null} canRead canPreview choose={choose} />);
    expect(screen.getByRole("alert").textContent).toContain(expected);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByTitle("Sample design preview")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Use branch default/ }));
    expect(choose).toHaveBeenCalledWith(null); expect(state.retry).not.toHaveBeenCalled();
  });

  it("keeps the pinned version visible and switches explicitly to the exact new choice or branch default", () => {
    const selected = choice();
    const update = choice({ templateVersionId: "new-version-id", version: 2, canPreview: false });
    const state = { ...library(), items: [update] };
    const onChoose = vi.fn();
    function Gallery() {
      const [selection, setSelection] = useState<QuotationTemplateChoice | null>(selected);
      return <QuotationTemplateGallery library={state} selected={selection} canRead canPreview choose={(next) => {
        onChoose(next);
        setSelection(next);
      }} />;
    }
    render(<Gallery />);

    expect(screen.getByText("Version 1")).toBeTruthy();
    expect(screen.getByText("Version 2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Preview design" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use template", pressed: false }));
    expect(onChoose).toHaveBeenLastCalledWith(update);
    expect(screen.getByRole("button", { name: "Selected template", pressed: true })).toBeTruthy();
    expect(screen.queryByText("Version 1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Use branch default/, pressed: false }));
    expect(onChoose).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("button", { name: /Use branch default/, pressed: true })).toBeTruthy();
  });

  it("shows a localized Arabic design identity and keeps pagination visible after an empty filtered page", () => {
    ui.lang = "ar";
    const state = { ...library(), cursor: "next", items: [choice({ name: "عرض سعر", locale: "ar-EG", layoutMode: "FIXED_CANVAS" })] };
    const choose = vi.fn();
    const { rerender } = render(<QuotationTemplateGallery library={state} selected={null} canRead canPreview choose={choose} />);
    expect(screen.getByText("عرض سعر").getAttribute("lang")).toBe("ar-EG");
    expect(screen.getByText("الإصدار 1")).toBeTruthy();
    expect(screen.queryByText(/FIXED_CANVAS|ar-EG/)).toBeNull();

    rerender(<QuotationTemplateGallery library={{ ...state, items: [] }} selected={null} canRead canPreview choose={choose} />);
    expect(screen.queryByText("لا توجد قوالب منشورة مطابقة")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "تحميل المزيد" }));
    expect(state.more).toHaveBeenCalledOnce();
  });
});
