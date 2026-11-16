"use client";

import { useCallback, useEffect, useState } from "react";
import { COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { useI18n } from "@/i18n/I18nContext";
import { loadChannels, ChannelPageLimitError } from "../channels/load-channels";
import { channelPath, parseChannelDetailResponse, type Channel } from "../channels/channel-contract";
import { tradeGet } from "../trade-api";

export function useTradeChannelChoices(companyId: string | null, branchId: string | null) {
  const { t } = useI18n();
  const key = `${companyId ?? ""}:${branchId ?? ""}`;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string; items: Channel[]; unavailable: Channel[]; error: NormalizedApiError | null; loading: boolean;
  }>({ key: "", items: [], unavailable: [], error: null, loading: false });
  const refreshChannels = useCallback(() => setRevision((current) => current + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted || !companyId) return;
      setState({ key, items: [], unavailable: [], error: null, loading: true });
      void (async () => {
        try {
          const headers = { [COMPANY_SCOPE_HEADER]: companyId };
          const result = await loadChannels({ signal: controller.signal, headers, maxResponseBytes: 200_000 });
          const active = result.items.filter((channel) => channel.status === "ACTIVE");
          const compatible: Channel[] = [];
          // Bound concurrency while verifying the owner-provided branch mappings.
          for (let offset = 0; offset < active.length; offset += 6) {
            if (controller.signal.aborted) return;
            const batch = active.slice(offset, offset + 6);
            const choices = await Promise.all(batch.map(async (channel) => {
              if (!branchId) return channel;
              const response = await tradeGet(channelPath(channel.id), {
                headers, signal: controller.signal, maxResponseBytes: 200_000,
              });
              const detail = parseChannelDetailResponse(response.data);
              return detail.branches.some((branch) => branch.branchId === branchId && branch.isActive)
                ? channel : null;
            }));
            compatible.push(...choices.filter((choice): choice is Channel => choice !== null));
          }
          if (!controller.signal.aborted) setState({ key, items: compatible,
            unavailable: active.filter((channel) => !compatible.some((choice) => choice.id === channel.id)), error: null, loading: false });
        } catch (error) {
          if (controller.signal.aborted) return;
          setState({ key, items: [], unavailable: [], loading: false, error: normalizeApiError(
            error instanceof ChannelPageLimitError ? new Error(t.trade.channelPageLimit) : error,
          ) });
        }
      })();
    });
    return () => controller.abort();
  }, [branchId, companyId, key, revision, t.trade.channelPageLimit]);
  const current = state.key === key && companyId !== null;
  return { channels: current ? state.items : [], unavailableChannels: current ? state.unavailable : [], channelsError: current ? state.error : null,
    isLoadingChannels: Boolean(companyId) && (!current || state.loading), refreshChannels };
}
