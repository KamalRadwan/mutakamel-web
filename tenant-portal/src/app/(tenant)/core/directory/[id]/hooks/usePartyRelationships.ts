"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { fetchParties } from "../../directory-api";
import {
  createRelationship,
  deleteRelationship,
  fetchPartyContacts,
} from "../../directory-children-api";
import {
  RELATIONSHIP_INVALID_CODE,
  type PartyContact,
} from "../../directory-children-contract";
import type { Party } from "../../directory-contract";
import {
  buildRelationshipCreate,
  type RelationshipFormValues,
} from "../../party-child-forms";

/**
 * Relationships, seen from one party.
 *
 * `GET /parties/:id/contacts` is the only read: it returns the organization →
 * person contact relationships and nothing else, takes no filters, and is empty
 * for a PERSON party. Creating one needs a second party, so the picker searches
 * the parties list rather than inventing a lookup route.
 */
export function usePartyRelationships(party: Party | null, canManage: boolean) {
  const { t } = useI18n();
  const toast = useToast();
  const copy = t.coreOperations.directory;

  const [contacts, setContacts] = useState<PartyContact[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PartyContact | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [candidates, setCandidates] = useState<Party[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const partyId = party?.id ?? null;
  const isOrganization = party?.partyType === "ORGANIZATION";

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!partyId || !isOrganization) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      try {
        const result = await fetchPartyContacts({ partyId, page, signal });
        setContacts(result.items);
        setTotal(result.total);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [partyId, isOrganization, page],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadToken]);

  const searchCandidates = useCallback(
    async (query: string): Promise<void> => {
      if (!canManage) return;
      setIsSearching(true);
      try {
        const result = await fetchParties({
          page: 1,
          search: query,
          sortBy: "displayName",
          sortDir: "ASC",
          // A contact relationship always points at a PERSON party; offering an
          // organization here would produce a `PARTY_RELATIONSHIP_INVALID`.
          filters: { partyType: "PERSON" },
        });
        setCandidates(result.items.filter((candidate) => candidate.id !== partyId));
      } catch {
        setCandidates([]);
      } finally {
        setIsSearching(false);
      }
    },
    [canManage, partyId],
  );

  const create = useCallback(
    async (values: RelationshipFormValues): Promise<boolean> => {
      if (!partyId || !canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        await createRelationship(buildRelationshipCreate(partyId, values));
        setIsCreateOpen(false);
        toast.success(copy.savedTitle, copy.relationshipCreated);
        setReloadToken((token) => token + 1);
        return true;
      } catch (error) {
        if (error instanceof Error && error.message === "RELATIONSHIP_FORM_TARGET") {
          setFormError(copy.relationshipTargetRequired);
          return false;
        }
        const normalized = normalizeApiError(error);
        if (normalized.status === 403) return false;
        if (toast.outcomeFromApi(normalized)) return false;
        if (normalized.code === RELATIONSHIP_INVALID_CODE) {
          setFormError(copy.relationshipInvalid);
          return false;
        }
        toast.errorFromApi(copy.relationshipCreateFailed, normalized);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [partyId, canManage, isSubmitting, toast, copy],
  );

  const remove = useCallback(async (): Promise<void> => {
    if (!deleting || !canManage || pendingId) return;
    setPendingId(deleting.relationshipId);
    try {
      await deleteRelationship(deleting.relationshipId);
      setContacts((current) =>
        current.filter((contact) => contact.relationshipId !== deleting.relationshipId),
      );
      setTotal((current) => Math.max(0, current - 1));
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        toast.errorFromApi(copy.relationshipDeleteFailed, normalized);
      }
    } finally {
      setPendingId(null);
      setDeleting(null);
    }
  }, [deleting, canManage, pendingId, toast, copy]);

  return {
    contacts,
    isOrganization,
    pageInfo: { page, limit: 25, total },
    isLoading: isLoading && isOrganization,
    loadError,
    isCreateOpen,
    isSubmitting,
    formError,
    deleting,
    pendingId,
    candidates,
    isSearching,
    setPage,
    searchCandidates,
    openCreate: () => {
      setFormError(null);
      setIsCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setFormError(null);
      setIsCreateOpen(false);
    },
    openDelete: (contact: PartyContact) => setDeleting(contact),
    closeDelete: () => {
      if (pendingId) return;
      setDeleting(null);
    },
    create,
    remove,
    reload: () => setReloadToken((token) => token + 1),
  };
}
