import { axiosClient } from "@/lib/api/axiosClient";
import { isUuidV7, readSubscriptionsPage } from "./readers";
import {
  SUBSCRIPTION_SORT_FIELDS,
  SUBSCRIPTION_STATUSES,
  type SubscriptionListQuery,
  type SubscriptionPage,
} from "./types";

export const SUBSCRIPTIONS_URL = "/api/admin/core/v1/subscriptions";

export const subscriptionsApi = {
  list: async (
    query: SubscriptionListQuery,
    signal?: AbortSignal,
  ): Promise<SubscriptionPage> => {
    const response = await axiosClient.get<unknown>(
      `${SUBSCRIPTIONS_URL}${serializeSubscriptionQuery(query)}`,
      { cache: "no-store", ...(signal ? { signal } : {}) },
    );
    return readSubscriptionsPage(response.data);
  },
};

export function serializeSubscriptionQuery(
  query: SubscriptionListQuery,
): string {
  if (
    !Number.isSafeInteger(query.page) ||
    query.page < 1 ||
    !Number.isSafeInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > 100 ||
    !SUBSCRIPTION_SORT_FIELDS.includes(query.sortBy) ||
    (query.sortDir !== "ASC" && query.sortDir !== "DESC") ||
    (query.status !== undefined &&
      !SUBSCRIPTION_STATUSES.includes(query.status)) ||
    (query.tenantId !== undefined && !isUuidV7(query.tenantId))
  ) {
    throw new TypeError("INVALID_SUBSCRIPTIONS_QUERY");
  }

  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  });
  if (query.status) params.set("status", query.status);
  if (query.tenantId) params.set("tenantId", query.tenantId);
  return `?${params.toString()}`;
}
