"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import type { InspectorBridge } from "../inspector/inspector-contract";
import type { TemplateRecoveryAuthority } from "../../template-recovery-policy";

function readable(authority: TemplateRecoveryAuthority, bridge: InspectorBridge) {
  return authority.readable && bridge.context().canRead && !!bridge.read().document;
}

export function useTemplateInspectorAuthority(authority: TemplateRecoveryAuthority, bridge: InspectorBridge) {
  const live = useRef({ authority, bridge });
  const mounted = useRef(false);
  useLayoutEffect(() => { live.current = { authority, bridge }; });
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = useCallback((key: string, epoch: number, bridgeKey: string, generation: number) => {
    const now = live.current;
    return mounted.current && now.authority.key === key && now.authority.epoch === epoch &&
      now.bridge.context().key === bridgeKey && now.bridge.read().generation === generation &&
      readable(now.authority, now.bridge) && now.authority.current();
  }, []);
  const generation = bridge.read().generation;
  return { current, readable: readable(authority, bridge),
    scopeKey: JSON.stringify([authority.key, authority.epoch, bridge.context().key, generation]) };
}
