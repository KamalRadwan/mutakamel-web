"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { getApiRequestOutcome } from "@/lib/api/axiosClient";
import {
  adminCan,
  adminCanAll,
  ADMIN_RBAC_CRITICAL,
  type AdminPermission,
} from "@/lib/auth/rbac";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import {
  isAmbiguousWriteOutcome,
  shouldRotateWriteCommandKey,
} from "@/shared/api/write-command-recovery";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { rolesApi } from "../api";
import type {
  AdminRole,
  ReplaceRolePermissionsCommand,
  UpdateRoleCommand,
} from "../contract";

interface OwnedIntent<T> {
  fingerprint: string;
  idempotencyKey: string;
  command: T;
  ambiguous: boolean;
}

/**
 * Which editor a server-confirmed role belongs to.
 *
 * The page carries two independent forms with their own Save buttons, and each
 * write answers with the whole role. Adopting all of it would let one editor's
 * success overwrite whatever the operator had typed or ticked in the other and
 * silently clear its dirty flag, so a response only overwrites the editor that
 * submitted it. The editor that did not submit still takes the new baseline —
 * it just keeps its unsaved draft on top of it, and stays dirty against it.
 */
type RoleApplyScope = "all" | "metadata" | "permissions";

export function useRoleDetail(id: string) {
  const router = useRouter();
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();

  const [role, setRole] = useState<AdminRole | null>(null);
  const [roleError, setRoleError] = useState<NormalizedApiError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roleRevision, setRoleRevision] = useState(0);

  const [catalogue, setCatalogue] = useState<AdminPermission[]>([]);
  const [catalogueError, setCatalogueError] =
    useState<NormalizedApiError | null>(null);
  const [isCatalogueLoading, setIsCatalogueLoading] = useState(true);
  const [catalogueRevision, setCatalogueRevision] = useState(0);
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [originalDescription, setOriginalDescription] = useState("");
  const [assignedPermissions, setAssignedPermissions] = useState<Set<string>>(
    new Set(),
  );
  const [originalPermissionIds, setOriginalPermissionIds] = useState<Set<string>>(
    new Set(),
  );

  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [metadataError, setMetadataError] =
    useState<NormalizedApiError | null>(null);
  const [permissionsError, setPermissionsError] =
    useState<NormalizedApiError | null>(null);
  const [metadataAmbiguous, setMetadataAmbiguous] = useState(false);
  const [permissionsAmbiguous, setPermissionsAmbiguous] = useState(false);
  const [metadataIdempotencyKey, setMetadataIdempotencyKey] = useState<string | undefined>(undefined);
  const [permissionsIdempotencyKey, setPermissionsIdempotencyKey] = useState<string | undefined>(undefined);
  const metadataIntentRef = useRef<OwnedIntent<UpdateRoleCommand> | null>(null);
  const permissionsIntentRef =
    useRef<OwnedIntent<ReplaceRolePermissionsCommand> | null>(null);

  // The baselines the drafts below are currently dirty against. Held as refs so
  // that applying a role can tell an untouched editor (safe to refresh in
  // place) from one carrying unsaved work, without re-creating this callback on
  // every keystroke.
  const baselineNameRef = useRef("");
  const baselineDescriptionRef = useRef("");
  const baselinePermissionIdsRef = useRef<readonly string[]>([]);

  const applyAuthoritativeRole = useCallback(
    (next: AdminRole, scope: RoleApplyScope) => {
      setRole(next);
      const previousName = baselineNameRef.current;
      const previousDescription = baselineDescriptionRef.current;
      const nextDescription = next.description ?? "";
      baselineNameRef.current = next.name;
      baselineDescriptionRef.current = nextDescription;
      setOriginalName(next.name);
      setOriginalDescription(nextDescription);
      const metadataIntent = metadataIntentRef.current;
      const metadataConfirmed =
        metadataIntent?.ambiguous === true &&
        next.name === metadataIntent.command.name &&
        next.description === metadataIntent.command.description;
      if (metadataConfirmed) {
        metadataIntentRef.current = null;
        setMetadataAmbiguous(false);
        setMetadataError(null);
        setMetadataIdempotencyKey(undefined);
      }
      const ownsMetadata = scope === "all" || scope === "metadata";
      if (!metadataIntent?.ambiguous || metadataConfirmed) {
        setName((current) =>
          ownsMetadata || current === previousName ? next.name : current,
        );
        setDescription((current) =>
          ownsMetadata || current === previousDescription
            ? nextDescription
            : current,
        );
      }

      const authoritativeIds = new Set(next.permissionIds);
      const previousPermissionIds = baselinePermissionIdsRef.current;
      baselinePermissionIdsRef.current = next.permissionIds;
      setOriginalPermissionIds(authoritativeIds);
      const permissionsIntent = permissionsIntentRef.current;
      const permissionsConfirmed =
        permissionsIntent?.ambiguous === true &&
        sameStringSet(
          next.permissionIds,
          permissionsIntent.command.permissionIds,
        );
      if (permissionsConfirmed) {
        permissionsIntentRef.current = null;
        setPermissionsAmbiguous(false);
        setPermissionsError(null);
        setPermissionsIdempotencyKey(undefined);
      }
      const ownsPermissions = scope === "all" || scope === "permissions";
      if (!permissionsIntent?.ambiguous || permissionsConfirmed) {
        setAssignedPermissions((current) =>
          ownsPermissions || sameStringSet([...current], previousPermissionIds)
            ? authoritativeIds
            : current,
        );
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const loadRole = async () => {
      setIsLoading(true);
      setRoleError(null);
      try {
        const result = await rolesApi.get(id, controller.signal);
        if (!disposed) applyAuthoritativeRole(result.data, "all");
      } catch (caught) {
        if (!disposed && !isAbortError(caught)) {
          setRoleError(normalizeApiError(caught));
        }
      } finally {
        if (!disposed) setIsLoading(false);
      }
    };
    queueMicrotask(() => void loadRole());
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [applyAuthoritativeRole, id, roleRevision]);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const loadCatalogue = async () => {
      setIsCatalogueLoading(true);
      setCatalogueError(null);
      try {
        const result = await rolesApi.permissions(controller.signal);
        if (!disposed) setCatalogue(result.data);
      } catch (caught) {
        if (!disposed && !isAbortError(caught)) {
          setCatalogueError(normalizeApiError(caught));
        }
      } finally {
        if (!disposed) setIsCatalogueLoading(false);
      }
    };
    queueMicrotask(() => void loadCatalogue());
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [catalogueRevision]);

  const isSystem = role?.isSystem ?? false;
  const isSuperAdmin = Boolean(
    role?.isSystem && role.name.trim().toLocaleLowerCase() === "super admin",
  );
  const canUpdateMetadata =
    role !== null && !isSystem && adminCan(user, "admin.roles.update");
  const canReplacePermissions =
    role !== null &&
    !isSystem &&
    adminCanAll(user, ADMIN_RBAC_CRITICAL.ROLES_UPDATE);

  const nameError = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return t.roles.nameRequiredError;
    if (trimmed.length < 2) return t.roles.nameTooShortError;
    if (trimmed.length > 120) return t.roles.nameTooLongError;
    return null;
  }, [name, t]);
  const descriptionError =
    description.trim().length > 2_000 ? t.roles.descriptionLengthError : null;

  const metadataDirty =
    name !== originalName || description !== originalDescription;
  const permissionsDirty = !sameStringSet(
    [...assignedPermissions],
    [...originalPermissionIds],
  );

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visiblePermissions = catalogue.filter((permission) =>
    [
      permission.key,
      permission.nameAr,
      permission.nameEn,
      permission.group,
      permission.description,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch)),
  );
  const groupedPermissions = visiblePermissions.reduce(
    (groups, permission) => {
      const group = permission.group || "Ungrouped";
      (groups[group] ??= []).push(permission);
      return groups;
    },
    {} as Record<string, AdminPermission[]>,
  );

  const saveMetadata = useCallback(async () => {
    if (!canUpdateMetadata || isSavingMetadata || nameError || descriptionError) {
      if (!canUpdateMetadata) setMetadataError(updateForbiddenError());
      return;
    }
    const trimmedDescription = description.trim();
    const command: UpdateRoleCommand = {
      name: name.trim(),
      description: trimmedDescription ? trimmedDescription : null,
    };
    const fingerprint = JSON.stringify(command);
    const current = metadataIntentRef.current;
    if (current?.ambiguous && current.fingerprint !== fingerprint) return;
    const intent =
      current?.fingerprint === fingerprint
        ? current
        : {
            fingerprint,
            command,
            idempotencyKey: generateUUIDv7(),
            ambiguous: false,
          };
    metadataIntentRef.current = intent;
    setMetadataIdempotencyKey(intent.idempotencyKey);
    setIsSavingMetadata(true);
    setMetadataError(null);
    try {
      const result = await rolesApi.update(id, command, intent.idempotencyKey);
      metadataIntentRef.current = null;
      setMetadataAmbiguous(false);
      setMetadataIdempotencyKey(undefined);
      applyAuthoritativeRole(result.data, "metadata");
      toast.success(t.roles.metadataSavedTitle, t.roles.metadataSavedDesc);
    } catch (caught) {
      const error = normalizeApiError(caught);
      const ambiguous = retainWriteIntent(caught, error);
      if (ambiguous) {
        metadataIntentRef.current = { ...intent, ambiguous: true };
      } else if (shouldRotateWriteCommandKey(error)) {
        metadataIntentRef.current = null;
        setMetadataIdempotencyKey(undefined);
      }
      setMetadataAmbiguous(ambiguous);
      setMetadataError(error);
      if (!ambiguous) {
        toast.error(t.roles.updateFailedTitle, error.message);
      }
    } finally {
      setIsSavingMetadata(false);
    }
  }, [
    applyAuthoritativeRole,
    canUpdateMetadata,
    description,
    descriptionError,
    id,
    isSavingMetadata,
    name,
    nameError,
    t,
    toast,
  ]);

  const savePermissions = useCallback(async () => {
    if (!canReplacePermissions || isSavingPermissions) {
      if (!canReplacePermissions) setPermissionsError(permissionsForbiddenError());
      return;
    }
    const permissionIds = [...assignedPermissions].sort();
    const command: ReplaceRolePermissionsCommand = { permissionIds };
    const fingerprint = JSON.stringify(command);
    const current = permissionsIntentRef.current;
    if (current?.ambiguous && current.fingerprint !== fingerprint) return;
    const intent =
      current?.fingerprint === fingerprint
        ? current
        : {
            fingerprint,
            command,
            idempotencyKey: generateUUIDv7(),
            ambiguous: false,
          };
    permissionsIntentRef.current = intent;
    setPermissionsIdempotencyKey(intent.idempotencyKey);
    setIsSavingPermissions(true);
    setPermissionsError(null);
    try {
      const result = await rolesApi.replacePermissions(
        id,
        command,
        intent.idempotencyKey,
      );
      permissionsIntentRef.current = null;
      setPermissionsAmbiguous(false);
      setPermissionsIdempotencyKey(undefined);
      applyAuthoritativeRole(result.data, "permissions");
      toast.success(t.roles.permissionsSavedTitle, t.roles.permissionsSavedDesc);
    } catch (caught) {
      const error = normalizeApiError(caught);
      const ambiguous = retainWriteIntent(caught, error);
      if (ambiguous) {
        permissionsIntentRef.current = { ...intent, ambiguous: true };
      } else if (shouldRotateWriteCommandKey(error)) {
        permissionsIntentRef.current = null;
        setPermissionsIdempotencyKey(undefined);
      }
      setPermissionsAmbiguous(ambiguous);
      setPermissionsError(error);
      if (!ambiguous) {
        toast.error(t.roles.updateFailedTitle, error.message);
      }
    } finally {
      setIsSavingPermissions(false);
    }
  }, [
    applyAuthoritativeRole,
    assignedPermissions,
    canReplacePermissions,
    id,
    isSavingPermissions,
    t,
    toast,
  ]);

  const togglePermission = useCallback(
    (permissionId: string) => {
      if (
        !canReplacePermissions ||
        permissionsAmbiguous ||
        !catalogue.some((permission) => permission.id === permissionId)
      ) {
        return;
      }
      setAssignedPermissions((current) => {
        const next = new Set(current);
        if (next.has(permissionId)) next.delete(permissionId);
        else next.add(permissionId);
        return next;
      });
    },
    [canReplacePermissions, catalogue, permissionsAmbiguous],
  );

  const toggleGroup = useCallback(
    (groupName: string, state: boolean) => {
      if (!canReplacePermissions || permissionsAmbiguous) return;
      setAssignedPermissions((current) => {
        const next = new Set(current);
        catalogue
          .filter((permission) => permission.group === groupName)
          .forEach((permission) => {
            if (state) next.add(permission.id);
            else next.delete(permission.id);
          });
        return next;
      });
    },
    [canReplacePermissions, catalogue, permissionsAmbiguous],
  );

  useEffect(() => {
    if (originalName) document.title = `Role: ${originalName} - Mutakamel Admin`;
  }, [originalName]);

  return {
    lang,
    t,
    router,
    role,
    roleError,
    reloadRole: () => setRoleRevision((current) => current + 1),
    name,
    setName,
    description,
    setDescription,
    nameError,
    descriptionError,
    metadataDirty,
    permissionsDirty,
    isSystem,
    isSuperAdmin,
    canUpdateMetadata,
    canReplacePermissions,
    search,
    setSearch,
    groupedPermissions,
    assignedPermissions,
    catalogueLength: catalogue.length,
    catalogueError,
    isCatalogueLoading,
    reloadCatalogue: () => setCatalogueRevision((current) => current + 1),
    isSaving: isSavingMetadata || isSavingPermissions,
    isSavingMetadata,
    isSavingPermissions,
    isLoading,
    metadataError,
    permissionsError,
    metadataAmbiguous,
    permissionsAmbiguous,
    metadataIdempotencyKey,
    permissionsIdempotencyKey,
    saveMetadata,
    savePermissions,
    togglePermission,
    toggleGroup,
  };
}

function updateForbiddenError(): NormalizedApiError {
  return localForbidden("admin.roles.update is required to edit role metadata.");
}

function permissionsForbiddenError(): NormalizedApiError {
  return localForbidden(
    "Both admin.roles.update and admin.roles.critical are required to replace role permissions.",
  );
}

function localForbidden(message: string): NormalizedApiError {
  return {
    isNormalized: true,
    httpStatus: 403,
    errorCode: "ADMIN_PERMISSION_DENIED",
    errorCategory: "AUTHORIZATION",
    message,
  };
}

function retainWriteIntent(
  original: unknown,
  error: NormalizedApiError,
): boolean {
  return (
    getApiRequestOutcome(original) === "settled-before-session-change" ||
    isAmbiguousWriteOutcome(error) ||
    /(?:UPSTREAM|UNAVAILABLE|TIMEOUT)/u.test(error.errorCode)
  );
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value) => right.includes(value))
  );
}

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}
