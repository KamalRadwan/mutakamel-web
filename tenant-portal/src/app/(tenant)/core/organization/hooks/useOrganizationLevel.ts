"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useRealtimeResync } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  createOrgNode,
  deleteOrgNode,
  fetchOrgNodes,
  readDeletionBlockers,
  updateOrgNode,
  type OrgLevel,
  type OrgNodeOf,
  type OrgNodeStatus,
} from "../../contracts/organization-contract";
import { ORG_LEVEL_CONFIG, ORG_PARENT_BODY_KEY } from "../level-config";

export interface OrgNodeFormValues {
  code: string;
  name: string;
  parentId: string;
  status: OrgNodeStatus;
  legalName: string;
  taxNumber: string;
  currencyCode: string;
  address: string;
  phone: string;
  isHeadquarters: boolean;
  leadUserId: string;
}

export const EMPTY_ORG_NODE_FORM: OrgNodeFormValues = {
  code: "",
  name: "",
  parentId: "",
  status: "ACTIVE",
  legalName: "",
  taxNumber: "",
  currencyCode: "",
  address: "",
  phone: "",
  isHeadquarters: false,
  leadUserId: "",
};

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Only the keys the DTO declares are sent. Core runs `forbidNonWhitelisted`, so
 * a stray key from the shared form object is a 400 rather than a silent ignore.
 */
function buildCreateBody(level: OrgLevel, values: OrgNodeFormValues): Record<string, unknown> {
  const config = ORG_LEVEL_CONFIG[level];
  const body: Record<string, unknown> = {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
  };
  if (config.parent) {
    body[ORG_PARENT_BODY_KEY[level as keyof typeof ORG_PARENT_BODY_KEY]] = values.parentId;
  }
  if (config.fields.includes("legalName")) body.legalName = optionalText(values.legalName);
  if (config.fields.includes("taxNumber")) body.taxNumber = optionalText(values.taxNumber);
  if (config.fields.includes("currencyCode")) {
    body.currencyCode = optionalText(values.currencyCode.toUpperCase());
  }
  if (config.fields.includes("address")) body.address = optionalText(values.address);
  if (config.fields.includes("phone")) body.phone = optionalText(values.phone);
  if (config.fields.includes("isHeadquarters")) body.isHeadquarters = values.isHeadquarters;
  if (config.fields.includes("leadUserId")) body.leadUserId = optionalText(values.leadUserId);
  return stripUndefined(body);
}

/** `code` is create-only; every update DTO accepts `status` and none accepts a code. */
function buildUpdateBody(level: OrgLevel, values: OrgNodeFormValues): Record<string, unknown> {
  const config = ORG_LEVEL_CONFIG[level];
  const body: Record<string, unknown> = {
    name: values.name.trim(),
    status: values.status,
  };
  if (config.fields.includes("legalName")) body.legalName = optionalText(values.legalName);
  if (config.fields.includes("taxNumber")) body.taxNumber = optionalText(values.taxNumber);
  if (config.fields.includes("currencyCode")) {
    body.currencyCode = optionalText(values.currencyCode.toUpperCase());
  }
  if (config.fields.includes("address")) body.address = optionalText(values.address);
  if (config.fields.includes("phone")) body.phone = optionalText(values.phone);
  if (config.fields.includes("isHeadquarters")) body.isHeadquarters = values.isHeadquarters;
  if (config.fields.includes("leadUserId")) body.leadUserId = optionalText(values.leadUserId);
  return stripUndefined(body);
}

function stripUndefined(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
}

export function useOrganizationLevel<L extends OrgLevel>(level: L) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const config = ORG_LEVEL_CONFIG[level];
  const canManage = user?.permissions.includes(config.managePermission) ?? false;

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [serverSearch, setServerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrgNodeStatus | undefined>(undefined);
  const [parentFilter, setParentFilter] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<OrgNodeOf<L>[]>([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: 25, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<NormalizedApiError | null>(null);
  const [editing, setEditing] = useState<OrgNodeOf<L> | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<OrgNodeOf<L> | null>(null);
  const [blockedNode, setBlockedNode] = useState<OrgNodeOf<L> | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setServerSearch(searchQuery.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    // Deferred past the effect body on purpose: a synchronous setState there
    // cascades an extra render (react-hooks/set-state-in-effect), and the abort
    // check means a torn-down screen never writes at all.
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      setQueryError(null);
      fetchOrgNodes(level, {
        page,
        search: serverSearch,
        status: statusFilter,
        parentId: parentFilter,
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          setRows(result.items as OrgNodeOf<L>[]);
          setPageInfo({ page: result.page, limit: result.limit, total: result.total });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setRows([]);
          setQueryError(normalizeApiError(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [level, page, serverSearch, statusFilter, parentFilter, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  // MASTER-PLAN 13.6: one line, and this list reconciles with the server on
  // an ALL-scoped resync, a realtime reconnect, and a return from offline.
  useRealtimeResync(reload);

  const runWrite = useCallback(
    async (work: () => Promise<void>): Promise<boolean> => {
      setIsSubmitting(true);
      setMutationError(null);
      try {
        await work();
        reload();
        return true;
      } catch (error) {
        setMutationError(normalizeApiError(error));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [reload],
  );

  const handleCreate = useCallback(
    (values: OrgNodeFormValues) =>
      runWrite(async () => {
        await createOrgNode(level, buildCreateBody(level, values));
        setIsCreateOpen(false);
      }),
    [level, runWrite],
  );

  const handleUpdate = useCallback(
    (values: OrgNodeFormValues) => {
      const target = editing;
      if (!target) return Promise.resolve(false);
      return runWrite(async () => {
        await updateOrgNode(level, target.id, buildUpdateBody(level, values));
        setEditing(null);
      });
    },
    [editing, level, runWrite],
  );

  const handleDelete = useCallback(async () => {
    const target = pendingDelete;
    if (!target) return;
    setIsSubmitting(true);
    setMutationError(null);
    try {
      await deleteOrgNode(level, target.id);
      setPendingDelete(null);
      reload();
    } catch (error) {
      const normalized = normalizeApiError(error);
      const found = readDeletionBlockers(normalized);
      setPendingDelete(null);
      if (found.length > 0) {
        setBlockers(found);
        setBlockedNode(target);
      } else {
        setMutationError(normalized);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [level, pendingDelete, reload]);

  return useMemo(
    () => ({
      t,
      lang,
      config,
      canManage,
      rows,
      pageInfo,
      isLoading,
      queryError,
      searchQuery,
      setSearchQuery,
      statusFilter,
      setStatusFilter,
      parentFilter,
      setParentFilter,
      page,
      setPage,
      reload,
      isSubmitting,
      mutationError,
      clearMutationError: () => setMutationError(null),
      isCreateOpen,
      openCreate: () => canManage && setIsCreateOpen(true),
      closeCreate: () => setIsCreateOpen(false),
      editing,
      startEdit: (node: OrgNodeOf<L>) => canManage && setEditing(node),
      cancelEdit: () => setEditing(null),
      pendingDelete,
      requestDelete: (node: OrgNodeOf<L>) => canManage && setPendingDelete(node),
      cancelDelete: () => setPendingDelete(null),
      blockedNode,
      blockers,
      dismissBlockers: () => setBlockedNode(null),
      handleCreate,
      handleUpdate,
      handleDelete,
    }),
    [
      blockedNode, blockers, canManage, config, editing, handleCreate, handleDelete,
      handleUpdate, isCreateOpen, isLoading, isSubmitting, lang, mutationError, page,
      pageInfo, parentFilter, pendingDelete, queryError, reload, rows, searchQuery,
      statusFilter, t,
    ],
  );
}
