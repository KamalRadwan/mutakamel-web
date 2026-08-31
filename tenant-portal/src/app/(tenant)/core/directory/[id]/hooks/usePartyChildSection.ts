"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/lib/api/errors";
import type { Party } from "../../directory-contract";

type ChildKey = "contactMethods" | "addresses" | "roles";

export interface ChildSectionConfig<TItem extends { id: string }, TValues> {
  key: ChildKey;
  canManage: boolean;
  create: (partyId: string, body: Record<string, unknown>) => Promise<TItem>;
  /** Roles have no PATCH route — the only edit is remove-and-re-add. */
  update?: (childId: string, body: Record<string, unknown>) => Promise<TItem>;
  remove: (childId: string) => Promise<void>;
  buildCreate: (values: TValues) => Record<string, unknown>;
  buildUpdate?: (current: TItem, values: TValues) => Record<string, unknown>;
  /** Maps a thrown form-validation marker to a sentence. */
  formMessage: (reason: string) => string | undefined;
  /**
   * Maps one documented rejection code to a sentence that names the *reason*.
   * A duplicate contact method is a configured outcome, not a constant, so the
   * message has to say which directory setting refused it.
   */
  apiMessage?: (code: string | undefined) => string | undefined;
  labels: { createFailed: string; updateFailed: string; deleteFailed: string; saved: string };
}

/**
 * One implementation for contact methods, addresses and roles.
 *
 * They differ only in their DTO and in whether a PATCH route exists, so three
 * copies of this state machine would be three places for the same bug. The
 * child id is what every edit and delete addresses — the party cannot rebuild
 * `/contact-methods/:methodId` on its own — so it is read straight off the
 * hydrated array rather than recomputed.
 */
export function usePartyChildSection<TItem extends { id: string }, TValues>(
  party: Party | null,
  setParty: (updater: (current: Party | null) => Party | null) => void,
  config: ChildSectionConfig<TItem, TValues>,
) {
  const { t } = useI18n();
  const toast = useToast();
  const [editing, setEditing] = useState<TItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TItem | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const applyItems = useCallback(
    (project: (items: TItem[]) => TItem[]) => {
      setParty((current) =>
        current
          ? ({
              ...current,
              [config.key]: project(current[config.key] as unknown as TItem[]),
            } as Party)
          : current,
      );
    },
    [setParty, config.key],
  );

  const report = useCallback(
    (error: unknown, title: string): boolean => {
      const reason = error instanceof Error ? error.message : "";
      const message = config.formMessage(reason);
      if (message) {
        setFormError(message);
        return false;
      }
      const normalized = normalizeApiError(error);
      if (normalized.status === 403) return false;
      if (toast.outcomeFromApi(normalized)) return false;
      const specific = config.apiMessage?.(normalized.code);
      if (specific) {
        setFormError(specific);
        return false;
      }
      toast.errorFromApi(title, normalized);
      return false;
    },
    [toast, config],
  );

  const submit = useCallback(
    async (values: TValues): Promise<boolean> => {
      if (!party || !config.canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        if (editing && config.update && config.buildUpdate) {
          const body = config.buildUpdate(editing, values);
          if (Object.keys(body).length === 0) {
            setEditing(null);
            return true;
          }
          const saved = await config.update(editing.id, body);
          applyItems((items) => items.map((item) => (item.id === saved.id ? saved : item)));
          setEditing(null);
        } else {
          const created = await config.create(party.id, config.buildCreate(values));
          applyItems((items) => [...items, created]);
          setIsCreateOpen(false);
        }
        toast.success(config.labels.saved, config.labels.saved);
        return true;
      } catch (error) {
        return report(error, editing ? config.labels.updateFailed : config.labels.createFailed);
      } finally {
        setIsSubmitting(false);
      }
    },
    [party, config, isSubmitting, editing, applyItems, toast, report],
  );

  const confirmDelete = useCallback(async (): Promise<void> => {
    if (!deleting || !config.canManage || pendingId) return;
    setPendingId(deleting.id);
    try {
      await config.remove(deleting.id);
      applyItems((items) => items.filter((item) => item.id !== deleting.id));
    } catch (error) {
      report(error, config.labels.deleteFailed);
    } finally {
      setPendingId(null);
      setDeleting(null);
    }
  }, [deleting, config, pendingId, applyItems, report]);

  return {
    t,
    items: (party?.[config.key] as unknown as TItem[]) ?? [],
    canManage: config.canManage,
    editing,
    isCreateOpen,
    isSubmitting,
    formError,
    deleting,
    pendingId,
    openCreate: () => {
      setFormError(null);
      setIsCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setFormError(null);
      setIsCreateOpen(false);
    },
    openEdit: (item: TItem) => {
      setFormError(null);
      setEditing(item);
    },
    closeEdit: () => {
      if (isSubmitting) return;
      setFormError(null);
      setEditing(null);
    },
    openDelete: (item: TItem) => setDeleting(item),
    closeDelete: () => {
      if (pendingId) return;
      setDeleting(null);
    },
    submit,
    confirmDelete,
  };
}
