"use client";

import { useMemo, useState } from "react";
import type { FilterValues } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { ACCOUNT_UI_COPY } from "../commercial-account-metadata";
import { isAccountRole, type AccountRole, type CommercialAccount } from "../commercial-account-contract";
import { useCommercialAccounts } from "./useCommercialAccounts";

export function useAccountWorkspace() {
  const { t, lang } = useI18n();
  const accounts = useCommercialAccounts();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [inspecting, setInspecting] = useState<CommercialAccount | null>(null);
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase(lang);
    return accounts.items.filter((item) => !query || [
      item.partyId, item.accountRole, isAccountRole(item.accountRole) ? t.trade[`accountRole_${item.accountRole}`] : item.accountRole,
      item.status, item.creditCurrencyCode ?? "", item.priceBookId ?? "", item.blockReasonCode ?? "",
    ].some((value) => value.toLocaleLowerCase(lang).includes(query)));
  }, [accounts.items, lang, searchQuery, t]);
  const stats = useMemo(() => ({
    total: accounts.pageInfo.total || accounts.items.length,
    customers: accounts.items.filter((item) => item.accountRole === "CUSTOMER").length,
    suppliers: accounts.items.filter((item) => item.accountRole === "SUPPLIER").length,
    blocked: accounts.items.filter((item) => item.status === "BLOCKED").length,
  }), [accounts.items, accounts.pageInfo.total]);
  const filterValues: FilterValues = {
    ...(accounts.roleFilter ? { accountRole: { kind: "select" as const, value: accounts.roleFilter } } : {}),
    ...(accounts.statusFilter ? { status: { kind: "select" as const, value: accounts.statusFilter } } : {}),
  };
  const changeFilters = (next: FilterValues) => {
    const role = next.accountRole;
    const status = next.status;
    accounts.setRoleFilter(role?.kind === "select" && role.value ? role.value as AccountRole : undefined);
    accounts.setStatusFilter(status?.kind === "select" && status.value ? status.value : undefined);
  };
  const resetFilters = () => {
    accounts.setRoleFilter(undefined);
    accounts.setStatusFilter(undefined);
    setSearchQuery("");
  };
  return { t, lang, copy: ACCOUNT_UI_COPY[lang], accounts, filteredItems, stats,
    searchQuery, setSearchQuery, viewMode, setViewMode, inspecting, setInspecting,
    filterValues, changeFilters, resetFilters, canEdit: accounts.canManage && !accounts.writeScopeGap };
}

export type AccountWorkspace = ReturnType<typeof useAccountWorkspace>;
