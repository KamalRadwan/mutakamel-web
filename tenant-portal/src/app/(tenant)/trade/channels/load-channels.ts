import type { TenantApiRequestConfig } from "@/lib/api/axiosClient";
import { tradeGet } from "../trade-api";
import { CHANNELS_PATH, parseChannelListResponse, type ChannelPage } from "./channel-contract";

// Bound the complete-list walk for both callers (AUD26-FE-TENANT-02 lead note).
const MAX_CHANNEL_PAGES = 20;

export class ChannelPageLimitError extends Error {
  constructor() {
    super("Channel list exceeds the 20-page limit; results are incomplete.");
    this.name = "ChannelPageLimitError";
  }
}

/** Filters and scope selection need every channel, including later pages. */
export async function loadChannels(
  config: TenantApiRequestConfig,
): Promise<Pick<ChannelPage, "items" | "total">> {
  const items: ChannelPage["items"] = [];
  for (let page = 1; page <= MAX_CHANNEL_PAGES; page++) {
    const response = await tradeGet(`${CHANNELS_PATH}?page=${page}&limit=100`, config);
    const result = parseChannelListResponse(response.data);
    if (result.page !== page || result.limit !== 100) {
      throw new Error("Invalid Trade channels pagination.");
    }
    items.push(...result.items);
    if (page * result.limit >= result.total) return { items, total: result.total };
    if (result.items.length < result.limit) throw new Error("Incomplete Trade channels response.");
  }
  throw new ChannelPageLimitError();
}
