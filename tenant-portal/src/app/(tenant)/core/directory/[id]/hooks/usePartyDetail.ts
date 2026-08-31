"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { deleteParty, fetchParty, updateParty } from "../../directory-api";
import {
  ADDRESS_MANAGE_PERMISSION,
  CONTACT_MANAGE_PERMISSION,
  PARTY_MANAGE_PERMISSION,
  PARTY_READ_PERMISSION,
  RELATIONSHIP_MANAGE_PERMISSION,
  ROLE_MANAGE_PERMISSION,
  buildUpdatePartyRequest,
  type Party,
  type PartyFormValues,
  type PartyStatus,
} from "../../directory-contract";

/**
 * One party, five independent grants.
 *
 * `directory.party.read` admits the screen; each child section is gated on its
 * own permission, because a caller can be allowed to see the record and
 * refused the right to edit its addresses.
 */
export function usePartyDetail(id: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const { user } = useTenantAuth();
  const permissions = user?.permissions ?? [];

  const grants = {
    canRead: permissions.includes(PARTY_READ_PERMISSION),
    canManageParty: permissions.includes(PARTY_MANAGE_PERMISSION),
    canManageContacts: permissions.includes(CONTACT_MANAGE_PERMISSION),
    canManageAddresses: permissions.includes(ADDRESS_MANAGE_PERMISSION),
    canManageRoles: permissions.includes(ROLE_MANAGE_PERMISSION),
    canManageRelationships: permissions.includes(RELATIONSHIP_MANAGE_PERMISSION),
  };

  const [party, setParty] = useState<Party | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMissing, setIsMissing] = useState(false);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!grants.canRead) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      setIsMissing(false);
      try {
        setParty(await fetchParty(id, signal));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const normalized = normalizeApiError(error);
        // A 404 means the request succeeded and the answer was "gone" — it gets
        // NotFoundState with no retry, never an error banner.
        if (normalized.status === 404) setIsMissing(true);
        else setLoadError(normalized);
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [grants.canRead, id],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadToken]);

  const reportFailure = useCallback(
    (error: unknown, title: string): void => {
      const normalized = normalizeApiError(error);
      if (normalized.status === 403) return;
      if (toast.outcomeFromApi(normalized)) return;
      toast.errorFromApi(title, normalized);
    },
    [toast],
  );

  const save = useCallback(
    async (values: PartyFormValues, status: PartyStatus): Promise<boolean> => {
      if (!party || !grants.canManageParty || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildUpdatePartyRequest(party, values, status);
        if (Object.keys(request).length === 0) {
          setIsEditOpen(false);
          return true;
        }
        setParty(await updateParty(party.id, request));
        setIsEditOpen(false);
        toast.success(t.coreOperations.directory.savedTitle, t.coreOperations.directory.partyUpdated);
        return true;
      } catch (error) {
        if (error instanceof Error && error.message === "PARTY_FORM_DISPLAY_NAME") {
          setFormError(t.coreOperations.directory.displayNameRequired);
          return false;
        }
        reportFailure(error, t.coreOperations.directory.partyUpdateFailed);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [party, grants.canManageParty, isSubmitting, toast, t, reportFailure],
  );

  const remove = useCallback(async (): Promise<void> => {
    if (!party || !grants.canManageParty || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteParty(party.id);
      toast.success(t.coreOperations.directory.savedTitle, t.coreOperations.directory.partyDeleted);
      router.push(TENANT_ROUTES.coreDirectory);
    } catch (error) {
      reportFailure(error, t.coreOperations.directory.partyDeleteFailed);
    } finally {
      setIsDeleting(false);
      setIsDeleteOpen(false);
    }
  }, [party, grants.canManageParty, isDeleting, toast, t, router, reportFailure]);

  return {
    t,
    lang,
    grants,
    party,
    isLoading: isLoading && grants.canRead,
    isMissing,
    loadError,
    isEditOpen,
    isSubmitting,
    formError,
    isDeleteOpen,
    isDeleting,
    setParty,
    openEdit: () => {
      setFormError(null);
      setIsEditOpen(true);
    },
    closeEdit: () => {
      if (isSubmitting) return;
      setFormError(null);
      setIsEditOpen(false);
    },
    openDelete: () => setIsDeleteOpen(true),
    closeDelete: () => {
      if (isDeleting) return;
      setIsDeleteOpen(false);
    },
    save,
    remove,
    reload: () => setReloadToken((token) => token + 1),
  };
}
