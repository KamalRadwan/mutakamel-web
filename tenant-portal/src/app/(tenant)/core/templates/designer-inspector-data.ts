import type { DesignerCommandStore } from "./designer-command-store";
import type { DescriptorBoundDesignerProvider } from "./designer-native-context";
import { createDataEligibilityPort } from "./[id]/bindings/data-eligibility";
import { createInspectorDataPorts } from "./[id]/bindings/InspectorDataPickers";
import { createInspectorDataValidator } from "./[id]/bindings/inspector-data-admission";
import type { InspectorDataPortHost } from "./[id]/bindings/inspector-data-contract";

/** One genuine host drives native Apply, eligibility and both controlled pickers. */
export function createDesignerInspectorData(provider: DescriptorBoundDesignerProvider, store: DesignerCommandStore, canStage: () => boolean, captured: { generation: number; selectedKey: string }) {
  const input = provider.dataHost;
  if (!input) return null;
  const current = () => provider.isCurrent() && input.bridge.context().canRead && store.getSnapshot().generation === captured.generation && store.getViewport().selectedIds.join(",") === captured.selectedKey &&
    input.bridge.read().document === store.getSnapshot().document && input.bridge.read().generation === store.getSnapshot().generation &&
    JSON.stringify(input.bridge.selection()) === JSON.stringify(store.getViewport().selectedIds) && input.readSourceFingerprint() === provider.identity.fingerprint;
  const host: InspectorDataPortHost = {
    bridge: { ...input.bridge,
      read: () => current() ? store.getSnapshot() : { ...store.getSnapshot(), document: null },
      context: () => { const value = input.bridge.context(); return { ...value, canRead: current(), readOnly: value.readOnly || !canStage() }; },
      canEdit: () => current() && canStage() && input.bridge.canEdit(),
      execute: document => current() && canStage() && input.bridge.canEdit() && input.bridge.execute(document),
      subscribe: store.subscribe,
    },
    readCatalogue: () => current() ? input.readCatalogue() : null,
    readNative: () => current() ? input.readNative() : null,
    readSourceFingerprint: () => current() ? input.readSourceFingerprint() : null,
  };
  if (!current()) return null;
  return { eligibility: createDataEligibilityPort(host), native: createInspectorDataValidator(host), ports: createInspectorDataPorts(host) };
}
