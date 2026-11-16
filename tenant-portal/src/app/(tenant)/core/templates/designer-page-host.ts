import { validateTemplateDocumentModel } from "@mutakamel/template-schema/browser-safe";
import type { DesignerCommandStore } from "./designer-command-store";
import type { DesignerInteractionBridge } from "./designer-interaction-contract";
import type { DescriptorBoundDesignerProvider } from "./designer-native-context";
import { createPageController } from "./pages/page-controller";
import type { PageHost } from "./pages/page-contract";
import type { EditorDocument } from "./template-editor-model";

export function supportsBasicSalesPageSetup(document: EditorDocument | null) {
  return !!document?.page && document.documentType === "QUOTATION" && document.outputChannel === "PRINT" &&
    document.dataSourceKey === "TRADE_QUOTATION_PRINT_V1" && document.canvasPages === undefined &&
    (document.layoutMode === "HYBRID_DOCUMENT" || document.layoutMode === "FLOW_DOCUMENT" || document.layoutMode === "FIXED_CANVAS");
}

/** Lifetime-bound façade: an old form cannot acquire a new owner's authority. */
type PageBridge = Pick<DesignerInteractionBridge, "context" | "canEdit" | "execute">;
export function createDesignerPageHost(store: DesignerCommandStore, initialBridge: PageBridge,
  provider: DescriptorBoundDesignerProvider | undefined, canLeave: () => boolean, assessLayout?: PageHost["assessLayout"]) {
  let bridge = initialBridge;
  const getBridge = () => bridge;
  const owner = initialBridge.context().key;
  const generation = store.getSnapshot().generation;
  let disposed = false;
  let connected = false;
  const subscriptions = new Set<{ start: () => () => void; stop: (() => void) | null }>();
  const subscribeWhenConnected = (start: () => () => void) => {
    const row = { start, stop: connected ? start() : null }; subscriptions.add(row);
    return () => { row.stop?.(); subscriptions.delete(row); };
  };
  let checkedBasicDocument: EditorDocument | null = null;
  let basicDocumentValid = false;
  const basicCurrent = () => {
    const document = store.getSnapshot().document;
    if (document !== checkedBasicDocument) {
      basicDocumentValid = supportsBasicSalesPageSetup(document) && validateTemplateDocumentModel(document).valid;
      checkedBasicDocument = document;
    }
    return basicDocumentValid;
  };
  const current = () => {
    const context = getBridge().context();
    return !disposed && context.canRead && context.key === owner &&
      (provider ? provider.isCurrent() : store.getSnapshot().generation === generation && basicCurrent());
  };
  const canEdit = () => current() && canLeave() && getBridge().canEdit() && !store.getSnapshot().gestureActive;
  const host: PageHost = {
    store: { ...store,
      // Construction is render-pure: T13's listeners attach only at commit.
      subscribe: listener => subscribeWhenConnected(() => store.subscribe(listener)),
      subscribeViewport: listener => subscribeWhenConnected(() => store.subscribeViewport(listener)),
      execute(command) {
        if (command.kind !== "EDIT_DOCUMENT" || !canEdit()) return false;
        if (!provider) return getBridge().execute(command.document);
        const result = provider.native.validateTemplateDocumentModel(command.document);
        return !!result.valid && !!result.document && canEdit() && getBridge().execute(result.document);
      },
      setViewport(patch) {
        if (!current() || (!canLeave() && (patch.selectedId !== undefined || patch.selectedIds !== undefined))) return false;
        return store.setViewport(patch);
      },
    },
    native: provider?.native ?? null,
    validateBasicPageDocument: provider ? undefined : validateTemplateDocumentModel,
    authorityKey: () => owner, canRead: current, canEdit, assessLayout,
  };
  const controller = createPageController(host);
  const access = () => JSON.stringify([current(), getBridge().context().key, canEdit()]);
  let accessKey = access();
  const refresh = () => {
    const next = access();
    if (next !== accessKey) { accessKey = next; controller.refresh(); }
  };
  const dispose = () => { disposed = true; connected = false; controller.dispose(); subscriptions.forEach(row => row.stop?.()); subscriptions.clear(); };
  return { ...controller,
    setBridge(next: PageBridge) { bridge = next; refresh(); },
    refresh,
    connect() {
      if (disposed) return () => {};
      connected = true;
      subscriptions.forEach(row => { if (!row.stop) row.stop = row.start(); });
      refresh();
      return () => {
        connected = false;
        subscriptions.forEach(row => { row.stop?.(); row.stop = null; });
        // StrictMode reconnects synchronously. A real unmount retires callbacks.
        queueMicrotask(() => { if (!connected) dispose(); });
      };
    },
    navigate(key: string) { return current() && canLeave() && controller.navigate(key); },
    dispose,
  };
}
