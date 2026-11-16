"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import type { CreateCustomFieldInput, CustomFieldItem, UpdateCustomFieldInput } from "../custom-field-contract";
import { useCrmCustomFields } from "./useCrmCustomFields";
import { useCustomFieldRecordValues } from "./useCustomFieldRecordValues";
import { useCustomFieldRequirements } from "./useCustomFieldRequirements";
import { useCustomFieldDialogFocus } from "./useCustomFieldDialogFocus";

export type CustomFieldsTab = "definitions" | "values";
export type CustomFieldOwnerFilter = "ALL" | CustomFieldItem["ownerType"];
export type CustomFieldStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export function useCustomFieldsSessionKey() {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  // Drop values and drafts when the actor, session or effective access changes.
  return JSON.stringify([user?.id, realtimeAuthGeneration, user?.isTenantOwner, user?.permissions,
    user?.permissionScopes, user?.accessibleBranches, user?.accessibleCompanies, user?.accessibleBranchCompanies,
    user?.teamMemberships, user?.featureEntitlements, user?.accessScope]);
}

export function useCustomFieldsPage() {
  const catalogue = useCrmCustomFields();
  const toast = useToast();
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [tab, setTab] = useState<CustomFieldsTab>("definitions");
  const [ownerFilter, setOwnerFilter] = useState<CustomFieldOwnerFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<CustomFieldStatusFilter>("ALL");
  const available = !catalogue.needsReload && !catalogue.error && !catalogue.isLoading;
  const requirements = useCustomFieldRequirements(catalogue.canManage && available, catalogue.reload);
  const dialogFocus = useCustomFieldDialogFocus(catalogue.isCreateOpen || !!catalogue.editor.selected || !!requirements.field);
  const recordValues = useCustomFieldRecordValues(catalogue.definitions, catalogue.canManage && available, catalogue.reload);
  const busy = catalogue.isCreating || catalogue.editor.isSaving || requirements.isSubmitting || recordValues.values.isSaving;
  const items = useMemo(() => catalogue.items.filter((field) =>
    (ownerFilter === "ALL" || field.ownerType === ownerFilter) &&
    (statusFilter === "ALL" || field.isActive === (statusFilter === "ACTIVE"))),
  [catalogue.items, ownerFilter, statusFilter]);
  const filtered = !!catalogue.searchQuery.trim() || ownerFilter !== "ALL" || statusFilter !== "ALL";

  return { ...catalogue, items, recordValues, busy, tab, ownerFilter, statusFilter, filtered, dialogFocus,
    openCreate: () => { dialogFocus.capture(); catalogue.openCreate(); },
    requirements: { ...requirements, select: (field: CustomFieldItem) => { dialogFocus.capture(); requirements.select(field); } },
    setOwnerFilter, setStatusFilter,
    selectTab: (next: string) => {
      if (busy || (next !== "definitions" && next !== "values") || next === tab) return;
      recordValues.leave(() => setTab(next));
    },
    reloadPage: () => {
      if (busy) return;
      if (tab === "values") recordValues.reload();
      else void catalogue.reload();
    },
    canCreate: catalogue.canManage && available && !catalogue.atCapacity && !busy,
    create: async (input: CreateCustomFieldInput) => {
      const ok = await catalogue.handleCreate(input);
      if (ok && mounted.current) toast.success(catalogue.t.crmCustomFields.fieldCreated);
      return ok;
    },
    editor: { ...catalogue.editor,
      select: (field: CustomFieldItem) => { dialogFocus.capture(); catalogue.editor.select(field); },
      save: async (input: UpdateCustomFieldInput) => {
      const ok = await catalogue.editor.save(input);
      if (ok && mounted.current) toast.success(catalogue.t.crmCustomFields.fieldSaved);
      return ok;
    } },
    resetFilters: () => {
      catalogue.setSearchQuery(""); setOwnerFilter("ALL"); setStatusFilter("ALL");
    },
  };
}

