"use client";

import { useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission } from "@/design-system";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { SCOPE_UNRESOLVED_ERROR, useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { parseCustomerProfileDetailResponse, type CustomerProfileDetail } from "../../customer-profiles/customer-profile-contract";
import { parseLeadDetailResponse } from "../../leads/lead-contract";

export interface OpportunityOwnerOption { id: string; displayName: string; avatarUrl: string | null }
interface OpportunitySourceLeadOption { id: string; displayName: string; summary: string | null }
interface LookupOptions { branchId: string | null; customerProfileId: string; enabled: boolean; action: "create" | "update"; leadId?: string | null; customerPartyId?: string | null }
interface CustomerOptions {
  key: string;
  item: CustomerProfileDetail | null;
  isLoading: boolean;
  error: NormalizedApiError | null;
}
interface OwnerOptions { key: string; items: OpportunityOwnerOption[]; isLoading: boolean; error: NormalizedApiError | null }
interface SourceLeadOptions { key: string; items: OpportunitySourceLeadOption[]; isLoading: boolean; error: NormalizedApiError | null }
const emptyCustomer: CustomerOptions = { key: "", item: null, isLoading: false, error: null };
const emptyOwners: OwnerOptions = { key: "", items: [], isLoading: false, error: null };
const emptySourceLead: SourceLeadOptions = { key: "", items: [], isLoading: false, error: null };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** CRM candidates respect caller scope; recipient pipeline eligibility stays server-authoritative. */
async function readOwners(branchId: string, action: "create" | "update", headers: Record<string, string>, signal: AbortSignal): Promise<OpportunityOwnerOption[]> {
  const items: OpportunityOwnerOption[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 40; page++) {
    const query = new URLSearchParams({ branchId, resource: "opportunities", action, limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const response = await axiosClient.get<unknown>(`/api/tenant/crm/v1/assignable-owners?${query}`, { signal, headers, cache: "no-store", maxResponseBytes: 512 * 1024 });
    const body = record(response.data);
    if (!body || !Array.isArray(body.items) || body.items.length > 100 || (body.nextCursor !== null && !isUUIDv7(body.nextCursor))) throw new Error("Invalid assignable owners response");
    for (const entry of body.items as unknown[]) {
      const item = record(entry);
      if (!item || !isUUIDv7(item.id) || typeof item.displayName !== "string" || !item.displayName.trim() || (item.avatarUrl !== null && typeof item.avatarUrl !== "string") || (cursor !== null && item.id <= cursor)) throw new Error("Invalid assignable owner");
      cursor = item.id;
      items.push({ id: item.id, displayName: item.displayName, avatarUrl: item.avatarUrl as string | null });
    }
    if (body.nextCursor === null) return items;
    if (!body.items.length || body.nextCursor !== cursor) throw new Error("Invalid assignable owners cursor");
  }
  throw new Error("Invalid assignable owners pagination");
}

export function useOpportunityFormLookups({ branchId, customerProfileId, enabled, action, leadId, customerPartyId }: LookupOptions) {
  const { user } = useTenantAuth();
  const authKey = useAuthScopeKey(user);
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const headers = scope.headers;
  const [revision, setRevision] = useState(0);
  const [owners, setOwners] = useState<OwnerOptions>(emptyOwners);
  const [customer, setCustomer] = useState<CustomerOptions>(emptyCustomer);
  const [sourceLead, setSourceLead] = useState<SourceLeadOptions>(emptySourceLead);
  const ownerKey = JSON.stringify([branchId, action, authKey, revision]);
  const customerKey = JSON.stringify([branchId, customerProfileId, authKey, revision]);
  const canReadLead = hasPermission(user?.permissions ?? [], "crm.leads.read", true);

  useEffect(() => {
    const controller = new AbortController();
    if (!enabled || !isUUIDv7(branchId)) return () => controller.abort();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!headers) { setOwners({ ...emptyOwners, key: ownerKey, error: SCOPE_UNRESOLVED_ERROR }); return; }
      setOwners({ ...emptyOwners, key: ownerKey, isLoading: true });
      void readOwners(branchId, action, headers, controller.signal).then(
        (items) => { if (!controller.signal.aborted) setOwners({ key: ownerKey, items, isLoading: false, error: null }); },
        (caught: unknown) => { if (!controller.signal.aborted) setOwners({ ...emptyOwners, key: ownerKey, error: normalizeApiError(caught) }); },
      );
    });
    return () => controller.abort();
  }, [enabled, branchId, action, headers, ownerKey]);

  useEffect(() => {
    const controller = new AbortController();
    if (!enabled || !isUUIDv7(branchId) || !isUUIDv7(customerProfileId)) return () => controller.abort();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setCustomer({ ...emptyCustomer, key: customerKey, isLoading: true });
      void (async () => {
        let item: CustomerProfileDetail;
        try {
          const response = await axiosClient.get<unknown>(`/api/tenant/crm/v1/customer-profiles/${encodeURIComponent(customerProfileId)}`, { signal: controller.signal, cache: "no-store", maxResponseBytes: 512 * 1024 });
          item = parseCustomerProfileDetailResponse(response.data);
          if (item.branchId !== branchId || item.id !== customerProfileId) throw new Error("Customer scope changed");
        } catch (caught) {
          if (!controller.signal.aborted) setCustomer({ ...emptyCustomer, key: customerKey, error: normalizeApiError(caught) });
          return;
        }
        if (controller.signal.aborted) return;
        setCustomer({ ...emptyCustomer, key: customerKey, item });
      })();
    });
    return () => controller.abort();
  }, [enabled, branchId, customerProfileId, customerKey]);

  const currentCustomer = enabled && customer.key === customerKey ? customer : emptyCustomer;
  const sourceId = action === "update" && leadId !== undefined ? leadId : currentCustomer.item?.sourceLeadId;
  const partyId = customerPartyId ?? currentCustomer.item?.partyId;
  const sourceKey = JSON.stringify([branchId, customerProfileId, sourceId, partyId, authKey, revision]);
  useEffect(() => {
    const controller = new AbortController();
    if (!enabled || !isUUIDv7(branchId) || !isUUIDv7(sourceId) || !isUUIDv7(partyId)) return () => controller.abort();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!canReadLead) { setSourceLead({ ...emptySourceLead, key: sourceKey, error: { status: 403 } }); return; }
      setSourceLead({ ...emptySourceLead, key: sourceKey, isLoading: true });
      void (async () => {
        try {
          const response = await axiosClient.get<unknown>(`/api/tenant/crm/v1/leads/${encodeURIComponent(sourceId)}`, { signal: controller.signal, cache: "no-store", maxResponseBytes: 512 * 1024 });
          const lead = parseLeadDetailResponse(response.data);
          if (lead.id !== sourceId || lead.branchId !== branchId || lead.partyId !== partyId) throw new Error("Source lead does not match customer");
          if (!controller.signal.aborted) setSourceLead({ key: sourceKey, isLoading: false, error: null, items: [{ id: lead.id, displayName: lead.displayName, summary: lead.interestSummary }] });
        } catch (caught) {
          if (!controller.signal.aborted) setSourceLead({ ...emptySourceLead, key: sourceKey, error: normalizeApiError(caught) });
        }
      })();
    });
    return () => controller.abort();
  }, [enabled, branchId, sourceId, partyId, canReadLead, sourceKey]);
  const currentSource = enabled && sourceLead.key === sourceKey ? sourceLead : emptySourceLead;
  const contacts = useMemo(() => {
    const item = currentCustomer.item;
    if (!item) return [];
    if (item.profileType !== "INDIVIDUAL") return item.contacts;
    return [{ partyId: item.partyId, relationshipId: null, displayName: item.displayName, firstName: item.firstName, lastName: item.lastName, honorificTitle: item.honorificTitle, jobTitle: item.jobTitle, isPrimary: true, email: item.email, phones: item.phones }, ...item.contacts.filter(({ partyId }) => partyId !== item.partyId)];
  }, [currentCustomer.item]);
  const reload = () => setRevision((value) => value + 1);
  return {
    owners: { ...(enabled && owners.key === ownerKey ? owners : emptyOwners), isLoading: enabled && isUUIDv7(branchId) && (owners.key !== ownerKey || owners.isLoading), reload },
    customer: { ...currentCustomer, contacts, sourceLeads: currentSource.items, leadError: currentSource.error, leadLoading: enabled && isUUIDv7(sourceId) && isUUIDv7(partyId) && (sourceLead.key !== sourceKey || sourceLead.isLoading), isLoading: enabled && isUUIDv7(branchId) && isUUIDv7(customerProfileId) && (customer.key !== customerKey || customer.isLoading), reload },
  };
}
