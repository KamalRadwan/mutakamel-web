import { axiosClient } from "@/lib/api/axiosClient";
import { contractFailure, readCommercialResponse, uuid7 } from "@/shared/api/commercial-contract";
import { addonKey, applicationKey, assertOwner, bindingsBody, compatibilityBody, createBody, deleteQuery, draftBody, grantsBody,
  lifecycleBody, priceBody, publishBody, readAddonDetail, readAddonPage, readAddonReceipt, readAuditPage, readPriceReceipt, readPrices,
  readVersion, readVersionPage, schemaBody, updateBody, type AddonCommand } from "../lib/addon-contract";

function base(owner: string, key?: string) {
  applicationKey(owner);
  if (key !== undefined) { addonKey(key); if (!key.startsWith(`${owner}.`)) contractFailure(); }
  return `/api/admin/core/v1/applications/${encodeURIComponent(owner)}/addons${key === undefined ? "" : `/${encodeURIComponent(key)}`}`;
}
const query = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); });
  return params.size ? `?${params}` : "";
};

export const addonsApi = {
  async list(owner: string, options: { page?: number; search?: string; lifecycleStatus?: string } = {}, signal?: AbortSignal) {
    const response = await axiosClient.get<unknown>(`${base(owner)}${query({ ...options, limit: 20 })}`, { signal, cache: "no-store" });
    return readCommercialResponse(response, value => {
      const result = readAddonPage(value);
      if (new Set(result.items.map(item => item.id)).size !== result.items.length || new Set(result.items.map(item => item.key)).size !== result.items.length) contractFailure();
      result.items.forEach(item => assertOwner(item, { applicationKey: owner }));
      return result;
    }, true);
  },
  async get(owner: string, key: string, signal?: AbortSignal) {
    const response = await axiosClient.get<unknown>(base(owner, key), { signal, cache: "no-store" });
    return readCommercialResponse(response, value => {
      const result = readAddonDetail(value); assertOwner(result, { applicationKey: owner, addonKey: key }); return result;
    });
  },
  async prices(owner: string, key: string, signal?: AbortSignal) {
    const response = await axiosClient.get<unknown>(`${base(owner, key)}/price-tiers`, { signal, cache: "no-store" });
    return readCommercialResponse(response, value => {
      const result = readPrices(value); assertOwner(result, { applicationKey: owner, addonKey: key });
      if (result.ladders.length !== 2) contractFailure();
      return result;
    });
  },
  async versions(owner: string, key: string, page = 1, signal?: AbortSignal) {
    const response = await axiosClient.get<unknown>(`${base(owner, key)}/versions${query({ page, limit: 20 })}`, { signal, cache: "no-store" });
    return readCommercialResponse(response, readVersionPage, true);
  },
  async version(owner: string, key: string, versionId: string, expectedAddonId: string, signal?: AbortSignal) {
    const response = await axiosClient.get<unknown>(`${base(owner, key)}/versions/${uuid7(versionId)}`, { signal, cache: "no-store" });
    return readCommercialResponse(response, value => {
      const result = readVersion(value);
      if (result.id !== versionId || result.addonId !== expectedAddonId || !result.publishedAt) contractFailure();
      return result;
    });
  },
  async audit(owner: string, key: string, expectedApplicationId: string, page = 1, signal?: AbortSignal) {
    const response = await axiosClient.get<unknown>(`${base(owner, key)}/audit${query({ page, limit: 20 })}`, { signal, cache: "no-store" });
    return readCommercialResponse(response, value => {
      const result = readAuditPage(value);
      if (result.items.some(item => item.moduleId !== expectedApplicationId)) contractFailure();
      return result;
    }, true);
  },
  async command(owner: string, key: string, command: AddonCommand, idempotencyKey: string) {
    const config = { headers: { "x-idempotency-key": uuid7(idempotencyKey) } };
    const url = base(owner, key);
    const response = await (async () => {
      switch (command.kind) {
        case "CREATE": return axiosClient.post<unknown>(base(owner), createBody(command.body), config);
        case "UPDATE": return axiosClient.patch<unknown>(url, updateBody(command.body), config);
        case "DRAFT_CREATE": return axiosClient.post<unknown>(`${url}/drafts`, draftBody(command.body), config);
        case "PUBLISH": return axiosClient.post<unknown>(`${url}/publish`, publishBody(command.body), config);
        case "DEPRECATE": return axiosClient.post<unknown>(`${url}/deprecate`, lifecycleBody(command.body), config);
        case "DISABLE": return axiosClient.post<unknown>(`${url}/disable`, lifecycleBody(command.body), config);
        case "VERSION_REVOKE": return axiosClient.post<unknown>(`${url}/versions/${uuid7(command.versionId)}/revoke`, lifecycleBody(command.body), config);
        case "DELETE": return axiosClient.delete<unknown>(`${url}${query(deleteQuery(command.body))}`, config);
        case "COMPATIBILITY_REPLACE": return axiosClient.patch<unknown>(`${url}/tier-compatibility`, compatibilityBody(command.body), config);
        case "FEATURE_GRANTS_REPLACE": return axiosClient.patch<unknown>(`${url}/feature-grants`, grantsBody(command.body), config);
        case "COMPONENT_BINDINGS_REPLACE": return axiosClient.patch<unknown>(`${url}/component-bindings`, bindingsBody(command.body), config);
        case "CONFIGURATION_SCHEMA_REPLACE": return axiosClient.patch<unknown>(`${url}/configuration-schema`, schemaBody(command.body), config);
      }
    })();
    return readCommercialResponse(response, value => {
      const result = readAddonReceipt(value);
      assertOwner(result, { applicationKey: owner, addonKey: key });
      if (result.operation !== command.kind) contractFailure();
      return result;
    });
  },
  async replacePrices(owner: string, key: string, expectedAddonId: string, input: ReturnType<typeof priceBody>, idempotencyKey: string) {
    const body = priceBody(input);
    const response = await axiosClient.patch<unknown>(`${base(owner, key)}/price-tiers`, body,
      { headers: { "x-idempotency-key": uuid7(idempotencyKey) } });
    return readCommercialResponse(response, value => {
      const result = readPriceReceipt(value);
      if (result.addonId !== expectedAddonId || result.billingCycle !== body.billingCycle) contractFailure();
      return result;
    });
  },
};
