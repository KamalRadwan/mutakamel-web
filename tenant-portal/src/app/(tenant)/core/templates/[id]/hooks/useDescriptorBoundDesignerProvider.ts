import { useEffect, useRef, useState } from "react";
import type { DesignerInteractionBridge } from "../../designer-interaction-contract";
import { createDescriptorBoundDesignerProvider, designerDescriptorIdentityKey, type DesignerNativeSource } from "../../designer-native-context";

/** The ribbon is keyed by source binding and authority; navigation never changes that key. */
export function useDescriptorBoundDesignerProvider(bridge: DesignerInteractionBridge, source?: DesignerNativeSource) {
  const [instance] = useState(() => ({ source, provider: source ? createDescriptorBoundDesignerProvider(source.browser, bridge, source.descriptor, source.binding, source.Handles, source.readValidationContext, source.dataHost) : null }));
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // StrictMode's immediate setup replay retains the same binding. An actual
      // unmount permanently retires retained native/inspector callbacks.
      queueMicrotask(() => { if (!mounted.current) instance.provider?.retire(); });
    };
  }, [instance]);
  // An equivalent accepted snapshot may reconstruct its JavaScript wrapper.
  // Exact owner identity/package pins select the binding, not wrapper identity.
  const same = !!source && !!instance.source && source.bindingKey === instance.source.bindingKey &&
    designerDescriptorIdentityKey(source.binding.identity) === designerDescriptorIdentityKey(instance.source.binding.identity);
  return same && instance.provider?.isCurrent() ? instance.provider : null;
}
