// @vitest-environment jsdom
import { validateTemplateDocumentModel } from "@mutakamel/template-schema/browser-safe";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { expect, it, vi } from "vitest";
import { quotationPdfEn } from "@/i18n/dictionaries/quotation-pdf";
import { createDesignerCommandStore } from "../../designer-command-store";
import type { DesignerInteractionBridge } from "../../designer-interaction-contract";
import { createDesignerInteractionExit } from "../../designer-interaction-exit";
import type { EditorDocument } from "../../template-editor-model";
import { assetContentHref, type TemplateAsset } from "../../template-assets-contract";
import { DesignerViewport } from "../components/DesignerViewport";
import { FixedDocumentAdapter } from "../components/adapters/FixedDocumentAdapter";
import { applyFixedQuotationFrame, moveFixedQuotationPosition, readFixedQuotationFrame, readFixedQuotationPosition } from "./useFixedQuotationPosition";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en" }) }));

const bodyId = "01890000-0000-7000-8000-000000000002";
const textId = "01890000-0000-7000-8000-000000000003";
const groupId = "01890000-0000-7000-8000-000000000004";

function quotation(): EditorDocument {
  return {
    schemaVersion: 1, documentType: "QUOTATION", outputChannel: "PRINT", layoutMode: "FIXED_CANVAS",
    dataSourceKey: "TRADE_QUOTATION_PRINT_V1", locale: "ar-EG", direction: "RTL",
    page: { unit: "MM", preset: "A4", widthMm: 210, heightMm: 297, orientation: "PORTRAIT", marginMm: { top: 12, end: 14, bottom: 12, start: 10 } },
    theme: { fontFamilyToken: "SYSTEM_SANS", baseFontSizePx: 16, textColor: "#111827", accentColor: "#2563EB", surfaceColor: "#FFFFFF", lineHeight: 1.5 },
    rootNodeIds: [bodyId],
    nodes: {
      [bodyId]: { id: bodyId, type: "container", parentId: null, childIds: [textId], hidden: false, locked: false, layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" } },
      [textId]: { id: textId, type: "text", parentId: bodyId, childIds: [], hidden: false, locked: false,
        layout: { kind: "ABSOLUTE", unit: "MM", x: 10, y: 20, width: 22, height: 10, rotationDeg: 0, zIndex: 0 }, style: {}, props: { text: "Sales quotation" } },
    },
  };
}

it.each([["RTL", "ar-EG"], ["LTR", "en-US"]] as const)(
  "renders only the scoped active protected image inside the ordinary %s frame and keeps selection and fallback",
  (direction, locale) => {
    const document = { ...quotation(), direction, locale };
    const assetId = "01890000-0000-7000-8000-000000000099";
    const newId = "01890000-0000-7000-8000-000000000100";
    document.nodes[textId].type = "image";
    document.nodes[textId].name = "Quotation logo";
    document.nodes[textId].props = { assetId, alt: "Brand mark", decorative: false };
    document.nodes[textId].style = { objectFit: "COVER" };
    const asset: TemplateAsset = { id: assetId, definitionId: null, assetType: "LOGO", originalFileName: "brand.png", mimeType: "image/png",
      sizeBytes: 1024, deliveryClass: "PRIVATE_ONLY", status: "ACTIVE", revision: 1, etag: `"asset:${assetId}:1"`,
      createdAt: "2026-11-13T00:00:00.000Z" };
    const select = vi.fn();
    const props = { document, label: "Fixed design", unavailableLabel: "Unavailable", select, ordinaryFixed: true, assets: [asset] };
    const { rerender } = render(<FixedDocumentAdapter {...props} />);
    const button = screen.getByRole("button", { name: "Quotation logo" });
    const image = () => within(button).getByRole("img", { name: "Brand mark" });
    const protectedSrc = (id: string) => new URL(assetContentHref(id), window.location.origin).href;
    expect((image() as HTMLImageElement).src).toBe(protectedSrc(assetId));
    expect(image()).toHaveAttribute("draggable", "false");
    expect(image()).toHaveStyle({ objectFit: "cover" });
    expect(button.parentElement).toHaveStyle({ inlineSize: "22mm", blockSize: "10mm" });
    fireEvent.click(image());
    expect(select).toHaveBeenCalledWith(textId);

    fireEvent.error(image());
    expect(within(button).queryByRole("img")).toBeNull();
    const placeholder = within(button).getByText("Brand mark");
    expect(placeholder).toBeVisible();
    expect(placeholder.parentElement).toHaveClass("size-full", "overflow-hidden");
    expect(button).toHaveClass("h-full");
    expect(button.parentElement).toHaveStyle({ inlineSize: "22mm", blockSize: "10mm" });
    const replacement = { ...asset, id: newId };
    const next = structuredClone(document);
    next.nodes[textId].props.assetId = newId;
    rerender(<FixedDocumentAdapter {...props} document={next} assets={[replacement]} />);
    expect((image() as HTMLImageElement).src).toBe(protectedSrc(newId));
    rerender(<FixedDocumentAdapter {...props} document={next} assets={[{ ...replacement, status: "RETIRED" }]} />);
    expect(within(button).queryByRole("img")).toBeNull();
    expect(within(button).getByText("Brand mark").parentElement).toHaveClass("size-full", "overflow-hidden");
    rerender(<FixedDocumentAdapter {...props} document={next} assets={[replacement]} ordinaryFixed={false} />);
    expect(within(button).queryByRole("img")).toBeNull();
  },
);

function setup(document = quotation()) {
  const store = createDesignerCommandStore();
  store.reset(document);
  const writable = { value: true };
  const ticket = { bridgeKey: "quotation", generation: store.getSnapshot().generation };
  const exit = createDesignerInteractionExit(ticket, () => ({ ...ticket, generation: store.getSnapshot().generation }));
  const execute = vi.fn((next: EditorDocument) => validateTemplateDocumentModel(next).valid && store.execute({ kind: "EDIT_DOCUMENT", document: next }));
  const begin = vi.fn(store.beginGesture);
  const update = vi.fn((token: number, next: EditorDocument) =>
    validateTemplateDocumentModel(next).valid && store.updateGesture(token, { kind: "EDIT_DOCUMENT", document: next }));
  const commit = vi.fn(store.commitGesture);
  const cancel = vi.fn(store.cancelGesture);
  const bridge: DesignerInteractionBridge = {
    read: store.getSnapshot, context: () => ({ key: ticket.bridgeKey, canRead: true }), canEdit: () => writable.value,
    selection: () => store.getViewport().selectedIds, select: selectedIds => store.setViewport({ selectedIds }),
    execute, begin, update, commit, cancel,
  };

  function Viewport() {
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const viewport = useSyncExternalStore(store.subscribeViewport, store.getViewport);
    const editor: Parameters<typeof DesignerViewport>[0]["editor"] = {
      document: state.document, viewport, gestureActive: state.gestureActive,
      selected: state.document?.nodes[viewport.selectedId ?? ""] ?? null, editable: writable.value,
      select: selectedId => store.setViewport({ selectedId }), setViewport: store.setViewport,
      interactionExit: exit, interactionBridge: bridge, commandStore: store,
      hasPending: false, localPending: false, conflict: false, nativeSource: undefined, assets: [],
      t: { quotationPdf: quotationPdfEn }, editableQuotationText: null, updateQuotationText: vi.fn(),
    };
    return <DesignerViewport editor={editor} layoutMode="FIXED_CANVAS" />;
  }
  return { store, bridge, execute, begin, update, commit, cancel, writable, ticket, Viewport };
}

const pointer = { pointerId: 7, pointerType: "mouse", isPrimary: true, clientX: 50, clientY: 60, button: 0, buttons: 1 };

function mockCapture(canvas: HTMLElement) {
  const ids = new Set<number>();
  const set = vi.fn((id: number) => { ids.add(id); });
  const release = vi.fn((id: number) => { ids.delete(id); });
  Object.assign(canvas, { setPointerCapture: set, releasePointerCapture: release, hasPointerCapture: (id: number) => ids.has(id) });
  return { set, release };
}

it.each([["RTL", "ar-EG", 8], ["LTR", "en-US", 12]] as const)(
  "drags one %s leaf through a rotated parent and a zoomed viewport with exactly one undo",
  async (direction, locale, expectedX) => {
    const source = { ...quotation(), direction, locale };
    source.nodes[bodyId].childIds = [groupId];
    source.nodes[groupId] = { id: groupId, type: "container", parentId: bodyId, childIds: [textId], hidden: false, locked: false,
      layout: { kind: "ABSOLUTE", unit: "MM", x: 45, y: 50, width: 60, height: 70, rotationDeg: 90, zIndex: 0 }, style: {}, props: {} };
    source.nodes[textId].parentId = groupId;
    const { store, begin, update, commit, cancel, Viewport } = setup(source);
    store.setViewport({ zoom: 1.5, panX: 30, panY: -20 });
    render(<Viewport />);
    const canvas = screen.getByLabelText(quotationPdfEn.designer.canvas);
    const capture = mockCapture(canvas);
    const node = await screen.findByRole("button", { name: "Sales quotation" });
    fireEvent.click(node);
    const half = { ...pointer, clientX: pointer.clientX + 5 * 96 / 25.4 * 1.5, clientY: pointer.clientY + 96 / 25.4 * 1.5 };
    const end = { ...pointer, clientX: pointer.clientX + 10 * 96 / 25.4 * 1.5, clientY: pointer.clientY + 2 * 96 / 25.4 * 1.5 };
    fireEvent.pointerDown(node, pointer);
    fireEvent.pointerMove(window, { ...pointer, clientX: 51 });
    expect(begin).not.toHaveBeenCalled();
    expect(store.getViewport().selectedIds).toEqual([textId]);
    fireEvent.pointerMove(window, half);
    expect(store.getSnapshot()).toMatchObject({ gestureActive: true, canUndo: false });
    expect(screen.getByRole("button", { name: "Size and position" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move right" })).toBeDisabled();
    fireEvent.pointerMove(window, end);
    fireEvent.pointerUp(window, { ...end, buttons: 0 });
    expect(store.getSnapshot().document?.nodes[textId].layout).toEqual({ ...source.nodes[textId].layout, x: expectedX, y: 10 });
    expect(store.getSnapshot().document?.nodes[groupId]).toEqual(source.nodes[groupId]);
    expect(store.getViewport().selectedIds).toEqual([textId]);
    expect(begin).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
    expect(capture.set).toHaveBeenCalledWith(pointer.pointerId);
    expect(capture.release).toHaveBeenCalledWith(pointer.pointerId);
    act(() => { expect(store.undo()).toBe(true); });
    expect(store.getSnapshot().document).toEqual(source);
    expect(store.getSnapshot().canUndo).toBe(false);
  });

it.each(["pointer cancel", "capture loss", "Escape", "blur", "selection", "zoom", "scroll", "read only", "overflow", "replaced draft"] as const)(
  "rolls back a live move on %s without adding history",
  reason => {
    const source = quotation();
    const { store, begin, commit, cancel, writable, Viewport } = setup(source);
    const rendered = render(<Viewport />);
    const canvas = screen.getByLabelText(quotationPdfEn.designer.canvas);
    const capture = mockCapture(canvas);
    const node = screen.getByRole("button", { name: "Sales quotation" });
    fireEvent.click(node);
    fireEvent.pointerDown(node, pointer);
    const moved = { ...pointer, clientX: 58, clientY: 62 };
    fireEvent.pointerMove(window, moved);
    expect(store.getSnapshot().gestureActive).toBe(true);
    expect(store.getSnapshot().document?.nodes[textId].layout).not.toEqual(source.nodes[textId].layout);
    switch (reason) {
      case "pointer cancel": fireEvent.pointerCancel(window, pointer); break;
      case "capture loss": fireEvent.lostPointerCapture(canvas, pointer); break;
      case "Escape": fireEvent.keyDown(canvas, { key: "Escape" }); break;
      case "blur": fireEvent.blur(window); break;
      case "selection": act(() => { store.setViewport({ selectedId: bodyId }); }); break;
      case "zoom": act(() => { store.setViewport({ zoom: 1.25 }); }); break;
      case "scroll": fireEvent.scroll(canvas); break;
      case "read only": writable.value = false; rendered.rerender(<Viewport />); break;
      case "overflow": fireEvent.pointerUp(window, { ...pointer, buttons: 0, clientX: 1000 }); break;
      case "replaced draft": act(() => { store.reset(source); }); break;
    }
    fireEvent.pointerUp(window, { ...moved, buttons: 0 });
    expect(begin).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(capture.release).toHaveBeenCalledWith(pointer.pointerId);
    expect(store.getSnapshot()).toMatchObject({ document: source, gestureActive: false, canUndo: false, dirty: false });
    if (reason === "overflow") expect(screen.getByRole("status")).toHaveTextContent(quotationPdfEn.designer.geometry.refused);
  });

it("preserves plain selection and touch Hand panning without starting a frame gesture", () => {
  const { store, begin, Viewport } = setup();
  render(<Viewport />);
  const canvas = screen.getByLabelText(quotationPdfEn.designer.canvas);
  mockCapture(canvas);
  const node = screen.getByRole("button", { name: "Sales quotation" });
  fireEvent.pointerDown(node, pointer);
  fireEvent.pointerMove(window, { ...pointer, clientX: 58 });
  fireEvent.pointerUp(node, { ...pointer, buttons: 0 });
  fireEvent.click(node);
  expect(store.getViewport().selectedIds).toEqual([textId]);
  fireEvent.pointerDown(node, { ...pointer, pointerType: "touch" });
  fireEvent.pointerMove(window, { ...pointer, pointerType: "touch", clientX: 70 });
  fireEvent.pointerUp(node, { ...pointer, pointerType: "touch", buttons: 0 });
  fireEvent.click(screen.getByRole("button", { name: quotationPdfEn.designer.hand }));
  fireEvent.pointerDown(canvas, { ...pointer, pointerType: "touch" });
  fireEvent.pointerMove(canvas, { ...pointer, pointerType: "touch", clientX: 80, clientY: 90 });
  fireEvent.pointerUp(canvas, { ...pointer, pointerType: "touch", buttons: 0 });
  expect(store.getViewport()).toMatchObject({ panX: 30, panY: 30, hand: true });
  expect(begin).not.toHaveBeenCalled();
  expect(store.getSnapshot().dirty).toBe(false);
});

it("refuses drag on a leaf with a locked ancestor", () => {
  const source = quotation();
  source.nodes[bodyId].locked = true;
  const { begin, Viewport } = setup(source);
  render(<Viewport />);
  const node = screen.getByRole("button", { name: "Sales quotation" });
  fireEvent.click(node);
  fireEvent.pointerDown(node, pointer);
  fireEvent.pointerMove(window, { ...pointer, clientX: 70 });
  fireEvent.pointerUp(window, { ...pointer, buttons: 0, clientX: 70 });
  expect(begin).not.toHaveBeenCalled();
});

it("drags a selected Fixed image with a primary pen and preserves its content", () => {
  const source = quotation();
  source.nodes[textId].type = "image";
  source.nodes[textId].props = { assetId: "01890000-0000-7000-8000-000000000099", alt: "Quotation logo", decorative: false };
  const { store, commit, Viewport } = setup(source);
  render(<Viewport />);
  const node = screen.getByRole("button", { name: "image" });
  mockCapture(screen.getByLabelText(quotationPdfEn.designer.canvas));
  fireEvent.click(node);
  const pen = { ...pointer, pointerType: "pen" };
  fireEvent.pointerDown(node, pen);
  const moved = { ...pen, clientX: pen.clientX + 4 * 96 / 25.4 };
  fireEvent.pointerMove(window, moved);
  fireEvent.pointerUp(window, { ...moved, buttons: 0 });
  expect(commit).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot().document?.nodes[textId]).toEqual({
    ...source.nodes[textId], layout: { ...source.nodes[textId].layout, x: 6 },
  });
});

it("moves the selected node with buttons and physical keyboard arrows on an ordinary RTL Fixed canvas", async () => {
  const { store, execute, Viewport } = setup();
  render(<Viewport />);
  const node = await screen.findByRole("button", { name: "Sales quotation" });
  expect(screen.queryByRole("button", { name: "Move right" })).toBeNull();
  fireEvent.click(node);
  fireEvent.click(screen.getByRole("button", { name: "Move right" }));
  expect(store.getSnapshot().document?.nodes[textId].layout).toMatchObject({ x: 9, y: 20, width: 22, height: 10 });
  expect(fireEvent.keyDown(node, { key: "ArrowUp", shiftKey: true })).toBe(false);
  expect(store.getSnapshot().document?.nodes[textId].layout).toMatchObject({ x: 9, y: 10 });
  expect(fireEvent.keyDown(node, { key: "ArrowUp", shiftKey: true, altKey: true })).toBe(true);
  expect(fireEvent.keyDown(node, { key: "ArrowUp", shiftKey: true })).toBe(false);
  expect(fireEvent.keyDown(node, { key: "ArrowUp" })).toBe(false);
  expect(screen.getByRole("status").textContent).toBe(quotationPdfEn.designer.geometry.refused);
  expect(store.getSnapshot().document?.nodes[textId].layout).toMatchObject({ x: 9, y: 0 });
  expect(store.getSnapshot()).toMatchObject({ dirty: true, canUndo: true });
  expect(execute).toHaveBeenCalledTimes(3);
});

it.each([["RTL", "ar-EG", 8], ["LTR", "en-US", 12]] as const)(
  "converts physical movement through the %s parent rotation and keeps the original draft in undo history",
  (direction, locale, expectedX) => {
    const source = { ...quotation(), direction, locale };
    source.nodes[bodyId].childIds = [groupId];
    source.nodes[groupId] = { id: groupId, type: "container", parentId: bodyId, childIds: [textId], hidden: false, locked: false,
      layout: { kind: "ABSOLUTE", unit: "MM", x: 45, y: 50, width: 60, height: 70, rotationDeg: 90, zIndex: 0 }, style: {}, props: {} };
    source.nodes[textId].parentId = groupId;
    const { store, bridge } = setup(source);
    bridge.select([textId]);
    const target = readFixedQuotationPosition(bridge)!;
    expect(moveFixedQuotationPosition(bridge, target, { x: 10, y: 2 })).toBe(true);
    expect(store.getSnapshot().document?.nodes[textId].layout).toEqual({ ...source.nodes[textId].layout, x: expectedX, y: 10 });
    expect(store.getSnapshot().document?.nodes[groupId]).toEqual(source.nodes[groupId]);
    expect(store.undo()).toBe(true);
    expect(store.getSnapshot().document).toEqual(source);
  });

it("matches ordinary RTL page and nested frame projection while retaining the native physical frame", () => {
  const document = quotation();
  document.nodes[bodyId].childIds = [groupId];
  document.nodes[groupId] = { id: groupId, type: "container", name: "Frame", parentId: bodyId, childIds: [textId],
    hidden: false, locked: false, layout: { kind: "ABSOLUTE", unit: "MM", x: 42, y: 46, width: 60, height: 70, rotationDeg: 12, zIndex: 0 },
    style: {}, props: {} };
  document.nodes[textId].parentId = groupId;
  const props = { document, label: "Fixed design", unavailableLabel: "Unavailable", select: vi.fn() };
  const before = structuredClone(document);
  const { rerender } = render(<FixedDocumentAdapter {...props} ordinaryFixed />);
  const frame = () => screen.getByRole("button", { name: "Sales quotation" }).parentElement!;
  const parentFrame = () => screen.getByRole("button", { name: "Frame" }).parentElement!;
  const pageBody = () => parentFrame().parentElement!.parentElement!;
  expect(frame()).toHaveAttribute("dir", "rtl");
  expect(frame().parentElement).toBe(parentFrame());
  expect(parentFrame()).toHaveAttribute("dir", "rtl");
  expect(parentFrame().style.transform).toBe("rotate(12deg)");
  expect(frame().style.insetInlineStart).toBe("10mm");
  expect(pageBody().style.insetInlineStart).toBe("10mm");
  rerender(<FixedDocumentAdapter {...props} />);
  expect(frame()).toHaveAttribute("dir", "ltr");
  expect(parentFrame()).toHaveAttribute("dir", "ltr");
  expect(parentFrame().style.transform).toBe("rotate(12deg)");
  expect(frame().style.insetInlineStart).toBe("10mm");
  expect(pageBody().style.insetInlineStart).toBe("14mm");
  expect(document).toEqual(before);
});

it("refuses a captured target after authority, selection or draft generation changes", () => {
  const { store, bridge, execute, writable } = setup();
  bridge.select([textId]);
  const target = readFixedQuotationPosition(bridge)!;
  const move = () => moveFixedQuotationPosition(bridge, target, { x: 1, y: 0 });
  writable.value = false;
  expect(move()).toBe(false);
  writable.value = true;
  bridge.select([bodyId]);
  expect(move()).toBe(false);
  store.reset(quotation());
  bridge.select([textId]);
  expect(move()).toBe(false);
  expect(execute).not.toHaveBeenCalled();
});

it("offers no move for a locked ancestor or an unrelated source tuple", () => {
  const source = quotation();
  source.nodes[bodyId].locked = true;
  const locked = setup(source);
  locked.bridge.select([textId]);
  expect(readFixedQuotationPosition(locked.bridge)).toBeNull();
  const unrelated = setup({ ...quotation(), dataSourceKey: "TRADE_OTHER_PRINT_V1" });
  unrelated.bridge.select([textId]);
  expect(readFixedQuotationPosition(unrelated.bridge)).toBeNull();
  const implicit = quotation();
  const explicit = setup({ ...implicit, canvasPages: [{
    id: "01890000-0000-7000-8000-000000000005", name: "Page 1", page: implicit.page, rootNodeIds: implicit.rootNodeIds,
  }] });
  explicit.bridge.select([textId]);
  expect(readFixedQuotationPosition(explicit.bridge)).toBeNull();
});

it("offers bounded text but no static table on the ordinary Fixed quotation canvas", () => {
  const { Viewport } = setup();
  render(<Viewport />);
  expect(screen.getByRole("button", { name: quotationPdfEn.text })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Static table" })).toBeNull();
});

it.each([["RTL", "ar-EG", 154, 140], ["LTR", "en-US", 10, 20]] as const)(
  "applies one undoable numeric leaf frame in %s using parent-relative physical coordinates",
  async (direction, locale, initialX, savedX) => {
    const source = { ...quotation(), direction, locale };
    const { store, execute, Viewport } = setup(source);
    render(<Viewport />);
    fireEvent.click(await screen.findByRole("button", { name: "Sales quotation" }));
    fireEvent.click(screen.getByRole("button", { name: "Size and position" }));
    const dialog = screen.getByRole("dialog", { name: "Size and position" });
    const number = (name: string) => within(dialog).getByRole("spinbutton", { name });
    expect(number("From parent left edge (mm)")).toHaveValue(initialX);
    for (const [name, value] of [
      ["From parent left edge (mm)", "20"], ["From parent top edge (mm)", "30"], ["Width (mm)", "26"],
      ["Height (mm)", "12"], ["Rotation (degrees)", "15"],
    ]) fireEvent.change(number(name), { target: { value } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
    expect(screen.queryByRole("dialog", { name: "Size and position" })).toBeNull();
    expect(store.getSnapshot().document?.nodes[textId]).toEqual({ ...source.nodes[textId],
      layout: { ...source.nodes[textId].layout, x: savedX, y: 30, width: 26, height: 12, rotationDeg: 15 } });
    expect(store.getSnapshot().document?.nodes[bodyId]).toEqual(source.nodes[bodyId]);
    expect(execute).toHaveBeenCalledOnce();
    act(() => { expect(store.undo()).toBe(true); });
    expect(store.getSnapshot().document).toEqual(source);
  });

it("refuses numeric edits with stale selection, document or authority and invalid rotated bounds", () => {
  const { store, bridge, execute, writable } = setup();
  bridge.select([textId]);
  const target = readFixedQuotationFrame(bridge)!;
  expect(applyFixedQuotationFrame(bridge, target, { ...target.frame, x: 0, y: 0, rotationDeg: 45 })).toBe(false);
  expect(applyFixedQuotationFrame(bridge, target, { ...target.frame, width: 0 })).toBe(false);
  expect(applyFixedQuotationFrame(bridge, target, { ...target.frame, rotationDeg: Number.NaN })).toBe(false);
  writable.value = false;
  expect(applyFixedQuotationFrame(bridge, target, { ...target.frame, y: 30 })).toBe(false);
  writable.value = true;
  bridge.select([bodyId]);
  bridge.select([textId]);
  expect(applyFixedQuotationFrame(bridge, target, { ...target.frame, y: 30 })).toBe(false);
  const latest = readFixedQuotationFrame(bridge)!;
  store.execute({ kind: "EDIT_DOCUMENT", document: structuredClone({ ...latest.document, metadata: { editorNote: "New revision" } }) });
  expect(applyFixedQuotationFrame(bridge, latest, { ...latest.frame, y: 30 })).toBe(false);
  expect(execute).not.toHaveBeenCalled();
});

it("admits an image leaf and refuses locked and non-leaf geometry", () => {
  const source = quotation();
  const assetId = "01890000-0000-7000-8000-000000000006";
  source.nodes[textId] = { ...source.nodes[textId], type: "image", props: { assetId, alt: "Quotation logo", decorative: false } };
  const { store, bridge } = setup(source);
  bridge.select([textId]);
  const target = readFixedQuotationFrame(bridge)!;
  expect(applyFixedQuotationFrame(bridge, target, { ...target.frame, y: 30, rotationDeg: 5 })).toBe(true);
  expect(store.getSnapshot().document?.nodes[textId].props).toEqual(source.nodes[textId].props);
  const locked = structuredClone(source);
  locked.nodes[bodyId].locked = true;
  store.reset(locked);
  bridge.select([textId]);
  expect(readFixedQuotationFrame(bridge)).toBeNull();
  const group = structuredClone(source);
  group.nodes[textId] = { ...group.nodes[textId], type: "container", childIds: [groupId], props: {} };
  group.nodes[groupId] = { ...source.nodes[textId], id: groupId, parentId: textId,
    layout: { ...source.nodes[textId].layout, x: 0, y: 0 } };
  store.reset(group);
  bridge.select([textId]);
  expect(readFixedQuotationFrame(bridge)).toBeNull();
  const explicit = { ...source, canvasPages: [{
    id: "01890000-0000-7000-8000-000000000005", name: "Page 1", page: source.page, rootNodeIds: source.rootNodeIds,
  }] };
  store.reset(explicit);
  bridge.select([textId]);
  expect(readFixedQuotationFrame(bridge)).toBeNull();
});

it("keeps untouched rotation and skips no-op geometry history entries after rounding", () => {
  const source = { ...quotation(), direction: "LTR", locale: "en-US" };
  source.nodes[textId].layout.rotationDeg = 12.34567;
  const { store, bridge, execute } = setup(source);
  bridge.select([textId]);
  const target = readFixedQuotationFrame(bridge)!;
  expect(applyFixedQuotationFrame(bridge, target, { ...target.frame, x: target.frame.x + 0.0001 })).toBe(true);
  expect(execute).not.toHaveBeenCalled();
  expect(store.getSnapshot().canUndo).toBe(false);
  expect(applyFixedQuotationFrame(bridge, target, { ...target.frame, y: 25 })).toBe(true);
  expect(store.getSnapshot().document?.nodes[textId].layout.rotationDeg).toBe(12.34567);
  expect(execute).toHaveBeenCalledOnce();
});
