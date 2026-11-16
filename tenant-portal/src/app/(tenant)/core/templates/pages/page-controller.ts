import type { EditorDocument } from "../template-editor-model";
import { addFixedPage, duplicateFixedPage, moveToFixedPage, removeFixedPage, reorderFixedPage, updatePageSetup } from "./page-commands";
import { clonePageValue, explicitPages, PageCommandError, pageTree, requireUnlocked, type PageConfig, type PageErrorCode, type PageHost, type PageSnapshot, type PageView, type RemovalReview } from "./page-contract";
import { insertFlowPageBreak, updateFlowPagination, updateZones, type ZoneSetup } from "./zone-flow-commands";

/** A view/command adapter over Main's canonical store; it owns no document or history. */
export function createPageController(host: PageHost) {
  const validateBasicPageDocument = host.validateBasicPageDocument;
  const basicSetupOnly = !host.native && !!validateBasicPageDocument;
  const validateNativeDocument = host.native?.validateTemplateDocumentModel.bind(host.native);
  let activeKey: string | null = null, rulers = true, printBounds = true, error: PageErrorCode | null = null;
  let generated: { base: EditorDocument; pages: readonly PageView[] } | null = null;
  let cached: PageSnapshot | null = null, cachedAuthority = host.authorityKey(), cachedSelected: string | null = null;
  const listeners = new Set<() => void>();
  const publish = () => { cached = null; listeners.forEach(listener => listener()); };
  const document = () => host.canRead() ? host.store.getSnapshot().document : null;
  const views = (value: EditorDocument | null): readonly PageView[] => {
    if (basicSetupOnly || !value || value.layoutMode === "EMAIL_FLOW") return [];
    if (value.layoutMode === "FIXED_CANVAS") return Array.isArray(value.canvasPages)
      ? explicitPages(value).map(page => ({ key: page.id, name: page.name, page: page.page, rootNodeIds: page.rootNodeIds }))
      : [{ key: "retained-single-page", name: "", page: value.page ?? null, rootNodeIds: value.rootNodeIds }];
    return generated?.base === value ? generated.pages : [];
  };
  const getSnapshot = (): PageSnapshot => {
    const value = document(), selectedId = host.store.getViewport().selectedId, authority = host.authorityKey();
    const blocked: PageErrorCode | null = !value || (!host.native && !basicSetupOnly) ? "unavailable" : !host.canEdit() ? "readOnly" : host.store.getSnapshot().gestureActive ? "busy" : null;
    const editable = blocked === null;
    if (cached && cached.document === value && cachedSelected === selectedId && cachedAuthority === authority && cached.blocked === blocked) return cached;
    if (cachedAuthority !== authority || !value) { activeKey = null; generated = null; error = null; }
    const pages = Object.freeze(views(value).map(page => Object.freeze(page)));
    const selectedPage = value?.layoutMode === "FIXED_CANVAS" && selectedId && value.nodes[selectedId]
      ? pages.find(page => pageTree(value, page.rootNodeIds).has(selectedId)) : undefined;
    if (selectedPage) activeKey = selectedPage.key;
    if (selectedId !== cachedSelected && !selectedPage && selectedId && !pages.find(page => page.key === activeKey)?.nodeIds?.includes(selectedId)) {
      activeKey = pages.find(page => page.nodeIds?.includes(selectedId))?.key ?? activeKey;
    }
    if (!pages.some(page => page.key === activeKey)) activeKey = pages[0]?.key ?? null;
    cachedAuthority = authority; cachedSelected = selectedId;
    cached = Object.freeze({ document: value, pages, activeKey, activeIndex: pages.findIndex(page => page.key === activeKey), selectedId: value && selectedId && value.nodes[selectedId] ? selectedId : null, basicSetupOnly, editable, blocked, printBounds, rulers, error });
    return cached;
  };
  const readEditable = (expected?: EditorDocument, validate = validateNativeDocument) => {
    const value = document();
    if (!value || !validate) throw new PageCommandError("unavailable");
    if (!host.canEdit()) throw new PageCommandError("readOnly");
    if (host.store.getSnapshot().gestureActive) throw new PageCommandError("busy");
    if (expected && expected !== value) throw new PageCommandError("stale");
    if (!validate(value).valid) throw new PageCommandError("invalid");
    return value;
  };
  const attempt = <T,>(operation: () => T): T | null => {
    try { const value = operation(); error = null; publish(); return value; }
    catch (cause) { error = cause instanceof PageCommandError ? cause.code : "invalid"; publish(); return null; }
  };
  const commit = (prepare: (base: EditorDocument) => EditorDocument, expected?: EditorDocument, mode?: "measured" | "basic-setup") => attempt(() => {
    const basicSetup = mode === "basic-setup";
    const validate = basicSetup ? validateBasicPageDocument : validateNativeDocument;
    if (!validate) throw new PageCommandError("unavailable");
    const authority = host.authorityKey(), generation = host.store.getSnapshot().generation, base = readEditable(expected, validate);
    const candidate = prepare(base);
    if (!validate(candidate).valid) throw new PageCommandError("invalid");
    if (JSON.stringify(candidate) === JSON.stringify(base)) return false;
    if (mode === "measured" && ["FLOW_DOCUMENT", "HYBRID_DOCUMENT"].includes(String(base.layoutMode)) &&
      (!host.assessLayout || !host.assessLayout(base, candidate))) throw new PageCommandError("layout");
    if (document() !== base || host.authorityKey() !== authority || host.store.getSnapshot().generation !== generation || !host.canEdit()) throw new PageCommandError("stale");
    const changed = host.store.execute({ kind: "EDIT_DOCUMENT", document: candidate });
    if (!changed && basicSetup) throw new PageCommandError("stale");
    return changed;
  }) ?? false;
  const addOrDuplicate = (duplicate: boolean, pageId: string, name: string) => {
    let nextPage: string | null = null;
    const changed = commit(base => {
      const result = duplicate ? duplicateFixedPage(base, pageId, name, host.native!) : addFixedPage(base, pageId, name, host.native!);
      nextPage = result.pageId; return result.document;
    });
    if (changed && nextPage) { activeKey = nextPage; host.store.setViewport({ selectedId: null }); publish(); }
    return changed;
  };
  const offDocument = host.store.subscribe(() => {
    const selectedId = host.store.getViewport().selectedId;
    if (!basicSetupOnly && selectedId && !document()?.nodes[selectedId]) host.store.setViewport({ selectedId: null });
    publish();
  });
  const offViewport = host.store.subscribeViewport(() => {
    if (host.store.getViewport().selectedId !== cachedSelected) publish();
  });
  return {
    getSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose() { offDocument(); offViewport(); listeners.clear(); },
    /** Mount calls this after read/edit/session authority changes without a document event. */
    refresh: publish,
    navigate(key: string) {
      if (!getSnapshot().pages.some(page => page.key === key)) return false;
      activeKey = key; host.store.setViewport({ selectedId: null }); publish(); return true;
    },
    setPrintBounds(value: boolean) { printBounds = value; publish(); },
    setRulers(value: boolean) { rulers = value; publish(); },
    clearError() { error = null; publish(); },
    /** Called only by T05's qualified owner adapter, bound to the exact authored reference. */
    acceptGeneratedPages(base: EditorDocument, pages: readonly { key: string; nodeIds: readonly string[] }[]) {
      if (basicSetupOnly || base !== document() || !["FLOW_DOCUMENT", "HYBRID_DOCUMENT"].includes(String(base.layoutMode))) return false;
      if (!pages.length || pages.length > 200 || new Set(pages.map(page => page.key)).size !== pages.length ||
        pages.some(page => typeof page.key !== "string" || !page.key || page.nodeIds.some(id => !base.nodes[id]))) return false;
      generated = { base, pages: pages.map(page => ({ key: page.key, name: "", page: base.page ?? null, rootNodeIds: [], nodeIds: Object.freeze([...page.nodeIds]) })) };
      publish(); return true;
    },
    setPageSetup(page: PageConfig, expected: EditorDocument, pageId?: string) {
      if (!basicSetupOnly) return commit(base => updatePageSetup(base, page, pageId), expected, "measured");
      return commit(base => {
        if (!base.page || pageId !== undefined) throw new PageCommandError("unsupported");
        const { preset, orientation, widthMm, heightMm, marginMm: { top, end, bottom, start } } = page;
        return updatePageSetup(base, { ...base.page, preset, orientation, widthMm, heightMm, marginMm: { top, end, bottom, start } });
      }, expected, "basic-setup");
    },
    setZones(setup: ZoneSetup, expected: EditorDocument) { return commit(base => updateZones(base, setup), expected, "measured"); },
    addPage: (pageId: string, name: string) => addOrDuplicate(false, pageId, name),
    duplicatePage: (pageId: string, name: string) => addOrDuplicate(true, pageId, name),
    reorderPage: (pageId: string, delta: -1 | 1) => commit(base => reorderFixedPage(base, pageId, delta)),
    requestRemoval(pageId: string): RemovalReview | null {
      return attempt(() => {
        const base = readEditable(), pages = explicitPages(base), page = pages.find(entry => entry.id === pageId);
        if (!page) throw new PageCommandError("stale");
        if (pages.length === 1) throw new PageCommandError("lastPage");
        const tree = pageTree(base, page.rootNodeIds); requireUnlocked(base, tree);
        return Object.freeze({ pageId, pageName: page.name, contentCount: tree.size - page.rootNodeIds.length, base, authorityKey: host.authorityKey(), generation: host.store.getSnapshot().generation });
      });
    },
    confirmRemoval(review: RemovalReview) {
      const wasActive = getSnapshot().activeKey === review.pageId;
      const changed = commit(base => {
        if (review.authorityKey !== host.authorityKey() || review.generation !== host.store.getSnapshot().generation) throw new PageCommandError("stale");
        return removeFixedPage(base, review.pageId);
      }, review.base);
      if (changed && wasActive) {
        const pages = explicitPages(document()!);
        const index = explicitPages(review.base).findIndex(page => page.id === review.pageId);
        activeKey = pages[Math.min(index, pages.length - 1)].id; publish();
      }
      return changed;
    },
    moveSelection(pageId: string) {
      const selectedId = getSnapshot().selectedId;
      if (!selectedId) return false;
      const changed = commit(base => moveToFixedPage(base, [selectedId], pageId, host.native!));
      if (changed) { activeKey = pageId; publish(); }
      return changed;
    },
    setFlowFlags(nodeId: string, patch: { keepTogether?: boolean; breakBefore?: boolean; breakAfter?: boolean }) {
      return commit(base => updateFlowPagination(base, nodeId, patch), undefined, "measured");
    },
    insertPageBreak(beforeId: string) {
      let selectedId: string | null = null;
      const changed = commit(base => { const result = insertFlowPageBreak(base, beforeId); selectedId = result.selectedId; return result.document; }, undefined, "measured");
      if (changed && selectedId) host.store.setViewport({ selectedId });
      return changed;
    },
    /** Pass a clone into local forms; authored values remain owned/frozen by the store. */
    pageSetup() { const state = getSnapshot(); const page = state.pages[state.activeIndex]?.page ?? state.document?.page; return page ? clonePageValue(page) : null; },
  };
}
export type PageController = ReturnType<typeof createPageController>;
