"use client";

import { useEffect, useMemo, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import {
  BODY_READ_OPTIONS,
  LEADS_DUPLICATE_CHECK_PATH,
  buildLeadDuplicateCheckRequest,
  parseLeadDuplicateCheckResponse,
  type LeadDuplicateMatch,
} from "../lead-bulk-contract";
import type { CreateLeadForm } from "../lead-create-contract";

const DEBOUNCE_MS = 500;

/**
 * Exact Directory duplicates for the lead being typed, from
 * `POST /api/tenant/crm/v1/leads/duplicate-check` (phone, email, tax number,
 * commercial registration, name). Debounced, and silent on failure: the
 * warning is advisory and must never block the form.
 *
 * Skipped when the form already reuses an existing company — that IS the
 * existing Party, so it cannot duplicate itself.
 */
export function useLeadDuplicateCheck(
  form: CreateLeadForm,
  branchId: string | null,
  enabled: boolean,
): LeadDuplicateMatch[] {
  const [matches, setMatches] = useState<LeadDuplicateMatch[]>([]);
  const corporate = form.leadProfileType === "CORPORATE";
  const reusesCompany = corporate && form.existingCompanyPartyId.length > 0;

  const request = useMemo(() => {
    if (!enabled || !branchId || reusesCompany) return null;
    return buildLeadDuplicateCheckRequest(corporate
      ? {
          branchId,
          name: form.companyName,
          phones: [...form.companyPhones, ...form.contacts.flatMap((contact) => contact.phones)],
          email: form.contacts.find((contact) => contact.email.trim())?.email,
          taxNumber: form.taxNumber,
          commercialRegistrationNumber: form.commercialRegistrationNumber,
        }
      : {
          branchId,
          name: `${form.firstName} ${form.lastName}`,
          phones: form.phones,
          email: form.email,
        });
  }, [
    branchId,
    corporate,
    enabled,
    form.commercialRegistrationNumber,
    form.companyName,
    form.companyPhones,
    form.contacts,
    form.email,
    form.firstName,
    form.lastName,
    form.phones,
    form.taxNumber,
    reusesCompany,
  ]);
  const requestKey = request ? JSON.stringify(request) : "";

  useEffect(() => {
    const controller = new AbortController();
    if (!requestKey) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) setMatches([]);
      });
      return () => controller.abort();
    }
    const timer = setTimeout(() => {
      void axiosClient
        .post<unknown>(LEADS_DUPLICATE_CHECK_PATH, JSON.parse(requestKey) as unknown, {
          ...BODY_READ_OPTIONS,
          signal: controller.signal,
        })
        .then((response) => {
          if (!controller.signal.aborted) setMatches(parseLeadDuplicateCheckResponse(response.data));
        })
        .catch(() => {
          if (!controller.signal.aborted) setMatches([]);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey]);

  return matches;
}
