import type { ViewportMapping } from "./designer-interaction-contract";

/** Bound to the admitted renderer's actual DOM and current draft authority. */
export interface DesignerMoveableSurface {
  readonly bindingKey: string;
  readonly overlayRoot: HTMLElement;
  readonly rootContainer: HTMLElement;
  readonly cspNonce?: string;
  targetFor(nodeId: string): HTMLElement | null;
  mapping(): ViewportMapping | null;
  isCurrent(): boolean;
  subscribeLayout(listener: () => void): () => void;
  getLayoutVersion(): number;
}
