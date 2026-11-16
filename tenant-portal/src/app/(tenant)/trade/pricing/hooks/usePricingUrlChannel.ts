"use client";

import { useEffect } from "react";
import type { usePricingScopeOptions } from "./usePricingScopeOptions";

export function usePricingUrlChannel(channelId: string | undefined, scope: ReturnType<typeof usePricingScopeOptions>) {
  // Reconcile a deep link with the visible scope before automatic evaluation.
  useEffect(() => {
    const requested = channelId?.trim();
    if (!requested || scope.isLoadingChannels || !scope.context.companyId) return;
    if (scope.channelOptions.some((option) => option.value === requested)) {
      queueMicrotask(() => scope.changeChannel(requested));
    }
  }, [channelId, scope]);
}
