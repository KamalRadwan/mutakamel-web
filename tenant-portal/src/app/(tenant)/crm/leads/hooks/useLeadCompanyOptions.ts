"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  leadCompanyContactsPath,
  leadCompanyOptionsPath,
  parseLeadCompanyContactOptions,
  parseLeadCompanyOptions,
  type LeadCompanyContactOption,
  type LeadCompanyOption,
} from "../lead-contract";

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Existing corporate lead companies and their contact people — MASTER-PLAN 8.4.
 *
 *   GET /leads/company-options?branchId=
 *   GET /leads/company-options/:companyPartyId/contacts?branchId=
 *
 * Both require `crm.leads.create`, so a user who may not create leads gets a
 * `403` here and the picker simply stays empty — it is only ever rendered
 * inside the create drawer, which that user cannot open.
 *
 * The **contacts** route is `BRANCH_REQUIRED` in the Gateway contract and the
 * options route is not. That asymmetry is real, was read from
 * `docs/generated/tenant-api-routes.json`, and sending the scope headers on
 * both would be harmless only because the options route declares no policy at
 * all — a route that declares `NONE` rejects them. They are sent on exactly the
 * one route that requires them.
 */
export function useLeadCompanyOptions(branchId: string | null, enabled: boolean) {
  const scopeHeaders = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const [companies, setCompanies] = useState<LeadCompanyOption[]>([]);
  const [contacts, setContacts] = useState<LeadCompanyContactOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    // Deferred to a microtask so no state is written synchronously during the
    // effect body — the same pattern every other loader in this module uses,
    // and what `react-hooks/set-state-in-effect` is guarding against.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!enabled || !isUUIDv7(branchId)) {
        setCompanies([]);
        return;
      }
      setIsLoadingCompanies(true);
      setError(null);
      void (async () => {
        try {
          const response = await axiosClient.get<unknown>(
            leadCompanyOptionsPath(branchId),
            {
              signal: controller.signal,
              cache: "no-store",
              maxResponseBytes: 512 * 1024,
            },
          );
          setCompanies(parseLeadCompanyOptions(response.data));
        } catch (caught) {
          if (isAbortError(caught) || controller.signal.aborted) return;
          setCompanies([]);
          setError(normalizeApiError(caught));
        } finally {
          if (!controller.signal.aborted) setIsLoadingCompanies(false);
        }
      })();
    });
    return () => controller.abort();
  }, [branchId, enabled]);

  const selectCompany = useCallback(
    async (companyPartyId: string | null) => {
      setSelectedCompanyId(companyPartyId);
      setContacts([]);
      if (!companyPartyId || !isUUIDv7(branchId)) return;
      setIsLoadingContacts(true);
      try {
        const response = await axiosClient.get<unknown>(
          leadCompanyContactsPath(companyPartyId, branchId),
          {
            cache: "no-store",
            maxResponseBytes: 512 * 1024,
            headers: scopeHeaders,
          },
        );
        setContacts(parseLeadCompanyContactOptions(response.data));
      } catch (caught) {
        setContacts([]);
        setError(normalizeApiError(caught));
      } finally {
        setIsLoadingContacts(false);
      }
    },
    [branchId, scopeHeaders],
  );

  return {
    companies,
    contacts,
    selectedCompanyId,
    isLoadingCompanies,
    isLoadingContacts,
    error,
    selectCompany,
    reset: () => {
      setSelectedCompanyId(null);
      setContacts([]);
      setError(null);
    },
  };
}
