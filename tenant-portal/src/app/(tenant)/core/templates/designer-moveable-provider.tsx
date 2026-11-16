"use client";
import { DesignerMoveableHandles } from "./[id]/components/DesignerMoveableHandles";
import type { DesignerHandleLayerProps } from "./[id]/components/DesignerInteractionPanel";
import { withDescriptorBoundDesignerHandles, type DescriptorBoundDesignerProvider } from "./designer-native-context";
import type { DesignerMoveableSurface } from "./designer-moveable-surface";

/** Create once per admitted surface/authority epoch, outside component rendering. */
export function createDesignerMoveableProvider(provider: DescriptorBoundDesignerProvider, surface: DesignerMoveableSurface): DescriptorBoundDesignerProvider | null {
  function BoundHandles(props: DesignerHandleLayerProps) {
    return <DesignerMoveableHandles {...props} surface={surface} />;
  }
  return withDescriptorBoundDesignerHandles(provider, BoundHandles);
}
