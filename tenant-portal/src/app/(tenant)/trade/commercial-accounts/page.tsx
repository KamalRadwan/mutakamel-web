"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CreditCard,
  Eye,
  Filter,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Truck,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  IdentifierText,
  Money,
  PageHeader,
  PermissionGate,
  SWATCH_SURFACE_PALETTES,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDate } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../trade-scope";
import {
  AccountInspectModal,
  CreateAccountDrawer,
  EditAccountDrawer,
} from "./components/AccountDrawers";
import { useCommercialAccounts } from "./hooks/useCommercialAccounts";
import {
  ACCOUNT_KNOWN_STATUSES,
  ACCOUNT_ROLES,
  isAccountRole,
  type AccountRole,
  type CommercialAccount,
} from "./commercial-account-contract";
import {
  ACCOUNT_ROLE_PALETTES,
  ACCOUNT_UI_COPY,
  parseVisualTerms,
} from "./commercial-account-metadata";

export default function TradeCommercialAccountsPage() {
  const { t, lang } = useI18n();
  const copy = ACCOUNT_UI_COPY[lang];
  const accounts = useCommercialAccounts();

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<CommercialAccount | null>(null);

  const filterValues: FilterValues = {
    ...(accounts.roleFilter
      ? { accountRole: { kind: "select" as const, value: accounts.roleFilter } }
      : {}),
    ...(accounts.statusFilter
      ? { status: { kind: "select" as const, value: accounts.statusFilter } }
      : {}),
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return accounts.items;
    return accounts.items.filter(
      (a) =>
        a.partyId.toLowerCase().includes(q) ||
        a.accountRole.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q) ||
        (a.creditCurrencyCode ?? "").toLowerCase().includes(q) ||
        (a.paymentTermsId ?? "").toLowerCase().includes(q) ||
        (a.priceBookId ?? "").toLowerCase().includes(q) ||
        (a.blockReasonCode ?? "").toLowerCase().includes(q),
    );
  }, [accounts.items, searchQuery]);

  const activeInspectorAccount = useMemo(() => {
    if (filteredItems.length === 0) return null;
    if (selectedId) {
      const found = filteredItems.find((a) => a.id === selectedId);
      if (found) return found;
    }
    return filteredItems[0] ?? null;
  }, [filteredItems, selectedId]);

  const kpiStats = useMemo(() => {
    const customers = accounts.items.filter((a) => a.accountRole === "CUSTOMER").length;
    const suppliers = accounts.items.filter((a) => a.accountRole === "SUPPLIER").length;
    const blocked = accounts.items.filter((a) => a.status === "BLOCKED").length;
    return {
      total: accounts.pageInfo.total || accounts.items.length,
      customers,
      suppliers,
      blocked,
    };
  }, [accounts.items, accounts.pageInfo.total]);

  const columns: ColumnDef<CommercialAccount>[] = [
    {
      id: "partyId",
      header: t.trade.accountParty,
      cell: (account) => {
        const role = isAccountRole(account.accountRole) ? account.accountRole : "CUSTOMER";
        const palette = ACCOUNT_ROLE_PALETTES[role];
        return (
          <div className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", palette.dotClass)} />
            <Link
              href={`${TENANT_ROUTES.tradeCommercialAccounts}/${account.id}`}
              className="text-xs font-semibold text-foreground hover:text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <IdentifierText>{account.partyId}</IdentifierText>
            </Link>
          </div>
        );
      },
    },
    {
      id: "accountRole",
      header: t.trade.accountRole,
      cell: (account) => {
        if (isAccountRole(account.accountRole)) {
          const palette = ACCOUNT_ROLE_PALETTES[account.accountRole];
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
                palette.badgeClass,
              )}
            >
              <span className={cn("size-1.5 rounded-full", palette.dotClass)} />
              {t.trade[`accountRole_${account.accountRole}`]}
            </span>
          );
        }
        return (
          <Badge tone="neutral">
            <IdentifierText>{account.accountRole}</IdentifierText>
          </Badge>
        );
      },
    },
    {
      id: "creditLimit",
      header: t.trade.accountCreditLimit,
      numeric: true,
      // A decimal string through `Money`, never `Number()`. Trailing zeros are
      // stripped upstream, so `10.50` arrives as "10.5".
      cell: (account) =>
        account.creditLimit === null ? (
          "—"
        ) : (
          <Money value={account.creditLimit} currency={account.creditCurrencyCode ?? undefined} />
        ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (account) =>
        (ACCOUNT_KNOWN_STATUSES as readonly string[]).includes(account.status) ? (
          <Badge tone={account.status === "ACTIVE" ? "positive" : "negative"}>
            {t.trade[`accountStatus_${account.status as "ACTIVE" | "BLOCKED"}`]}
          </Badge>
        ) : (
          <Badge tone="neutral">
            <IdentifierText>{account.status}</IdentifierText>
          </Badge>
        ),
    },
    {
      id: "updatedAt",
      header: t.trade.updatedAt,
      cell: (account) => formatDate(account.updatedAt, lang),
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end" as const,
      sticky: "end" as const,
      width: "6.5rem",
      cell: (account: CommercialAccount) => (
        <span className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                className="w-7 px-0"
                aria-label={t.trade.accountDetailTitle}
                onClick={() => setInspecting(account)}
              >
                <Eye className="size-3.5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.trade.accountDetailTitle}</TooltipContent>
          </Tooltip>
          {accounts.canManage && !accounts.writeScopeGap && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  className="w-7 px-0"
                  aria-label={t.trade.accountEditTitle}
                  disabled={accounts.isSubmitting}
                  onClick={() => accounts.openEdit(account)}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.trade.accountEditTitle}</TooltipContent>
            </Tooltip>
          )}
        </span>
      ),
    },
  ];

  const indigoSwatch = SWATCH_SURFACE_PALETTES.indigo;
  const blueSwatch = SWATCH_SURFACE_PALETTES.blue;
  const purpleSwatch = SWATCH_SURFACE_PALETTES.purple;
  const redSwatch = SWATCH_SURFACE_PALETTES.red;

  return (
    <PermissionGate require={TRADE_PERMISSIONS.commercialAccountsRead}>
      <div className="flex flex-col gap-4">
        <PageHeader
          className="sr-only"
          title={t.trade.accountsTitle}
          description={t.trade.accountsSubtitle}
          primaryAction={
            accounts.canManage && !accounts.writeScopeGap
              ? { label: t.trade.accountCreate, onClick: accounts.openCreate }
              : undefined
          }
          secondaryActions={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void accounts.reload()}
              disabled={accounts.isRefreshing}
            >
              <RefreshCw
                className={accounts.isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.trade.reload}
            </Button>
          }
        />

        <TradeScopeBar hideWhenSingleScope />

        {accounts.scopeGap ? (
          <EmptyState
            icon={Filter}
            title={t.trade.scopeRequiredTitle}
            description={t.trade.accountScopeRequiredDescription}
          />
        ) : (
          <>
            {/* Executive Colorful KPI Strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-card p-3.5 shadow-xs",
                  indigoSwatch.sectionCard,
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-1", indigoSwatch.dot)} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {copy.totalAccounts}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md",
                      indigoSwatch.iconBoxIdle,
                    )}
                  >
                    <Building2 className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-foreground">{kpiStats.total}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{copy.totalAccountsSub}</p>
              </div>

              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-card p-3.5 shadow-xs",
                  blueSwatch.sectionCard,
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-1", blueSwatch.dot)} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t.trade.accountRole_CUSTOMER}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md",
                      blueSwatch.iconBoxIdle,
                    )}
                  >
                    <Users className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {kpiStats.customers}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{copy.customersSub}</p>
              </div>

              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-card p-3.5 shadow-xs",
                  purpleSwatch.sectionCard,
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-1", purpleSwatch.dot)} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t.trade.accountRole_SUPPLIER}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md",
                      purpleSwatch.iconBoxIdle,
                    )}
                  >
                    <Truck className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {kpiStats.suppliers}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{copy.suppliersSub}</p>
              </div>

              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-card p-3.5 shadow-xs",
                  redSwatch.sectionCard,
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-1", redSwatch.dot)} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t.trade.accountStatus_BLOCKED}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md",
                      redSwatch.iconBoxIdle,
                    )}
                  >
                    <ShieldAlert className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className={cn("mt-2 text-2xl font-semibold", redSwatch.iconText)}>
                  {kpiStats.blocked}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{copy.blockedSub}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <FilterBar
                  filters={[
                    {
                      id: "accountRole",
                      kind: "select",
                      label: t.trade.accountRole,
                      placeholder: t.trade.statusAny,
                      options: ACCOUNT_ROLES.map((role) => ({
                        value: role,
                        label: t.trade[`accountRole_${role}`],
                      })),
                    },
                    {
                      id: "status",
                      kind: "select",
                      label: t.common.status,
                      placeholder: t.trade.statusAny,
                      // Only the two proven members are offered. The filter accepts
                      // any string, but offering an invented one would be a guess.
                      options: ACCOUNT_KNOWN_STATUSES.map((status) => ({
                        value: status,
                        label: t.trade[`accountStatus_${status}`],
                      })),
                    },
                  ]}
                  values={filterValues}
                  onChange={(next) => {
                    const role = next.accountRole;
                    const status = next.status;
                    accounts.setRoleFilter(
                      role?.kind === "select" && role.value
                        ? (role.value as AccountRole)
                        : undefined,
                    );
                    accounts.setStatusFilter(
                      status?.kind === "select" && status.value ? status.value : undefined,
                    );
                  }}
                  onReset={() => {
                    accounts.setRoleFilter(undefined);
                    accounts.setStatusFilter(undefined);
                    setSearchQuery("");
                  }}
                  searchValue={searchQuery}
                  onSearchChange={setSearchQuery}
                  clearAllLabel={t.trade.clearFilters}
                  filtersLabel={t.common.filter}
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
                  <Button
                    type="button"
                    size="xs"
                    variant={viewMode === "table" ? "outline" : "ghost"}
                    onClick={() => setViewMode("table")}
                    className="gap-1 text-xs font-medium"
                  >
                    <List className="size-3.5" aria-hidden="true" />
                    {copy.tableView}
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={viewMode === "cards" ? "outline" : "ghost"}
                    onClick={() => setViewMode("cards")}
                    className="gap-1 text-xs font-medium"
                  >
                    <LayoutGrid className="size-3.5" aria-hidden="true" />
                    {copy.cardsView}
                  </Button>
                </div>

                {accounts.canManage && !accounts.writeScopeGap && (
                  <Button size="sm" variant="primary" onClick={accounts.openCreate}>
                    <Plus className="size-3.5" aria-hidden="true" />
                    {t.trade.accountCreate}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <div className={cn(activeInspectorAccount ? "xl:col-span-8" : "xl:col-span-12")}>
                {viewMode === "table" ? (
                  <DataTable
                    density="compact"
                    columns={columns}
                    rows={filteredItems}
                    isLoading={accounts.isLoading}
                    error={accounts.queryError}
                    onRetry={() => void accounts.reload()}
                    page={accounts.pageInfo}
                    onPageChange={accounts.setPage}
                    rowKey={(account) => account.id}
                    onRowClick={(account) => setSelectedId(account.id)}
                    labels={{
                      retry: t.common.retry,
                      errorTitle: t.trade.accountLoadFailed,
                      emptyTitle: t.trade.accountEmpty,
                      selectAll: t.common.actions,
                      selectRow: t.common.actions,
                      sortAscending: t.common.actions,
                      sortDescending: t.common.actions,
                      notSorted: t.common.actions,
                      pagination: {
                        previous: t.common.previousPage,
                        next: t.common.nextPage,
                        summary: (from, to, total) =>
                          formatTemplate(t.common.showingOf, { from, to, total }),
                      },
                    }}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {filteredItems.map((account) => {
                      const role = isAccountRole(account.accountRole)
                        ? account.accountRole
                        : "CUSTOMER";
                      const palette = ACCOUNT_ROLE_PALETTES[role];
                      const isSelected = activeInspectorAccount?.id === account.id;
                      return (
                        <div
                          key={account.id}
                          onClick={() => setSelectedId(account.id)}
                          className={cn(
                            "relative cursor-pointer overflow-hidden rounded-lg border bg-card p-4 shadow-xs transition-all hover:shadow-md",
                            isSelected
                              ? cn("ring-2 ring-primary/30", palette.cardBorderClass)
                              : "border-border",
                          )}
                        >
                          <div
                            className={cn(
                              "absolute inset-x-0 top-0 h-1.5",
                              palette.topAccentClass,
                            )}
                          />
                          <div className="flex items-start justify-between gap-2 pt-1">
                            <div className="min-w-0">
                              <Link
                                href={`${TENANT_ROUTES.tradeCommercialAccounts}/${account.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs font-semibold text-foreground hover:text-primary hover:underline"
                              >
                                <IdentifierText>{account.partyId}</IdentifierText>
                              </Link>
                              <div className="mt-1">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold",
                                    palette.badgeClass,
                                  )}
                                >
                                  <span className={cn("size-1.5 rounded-full", palette.dotClass)} />
                                  {isAccountRole(account.accountRole)
                                    ? t.trade[`accountRole_${account.accountRole}`]
                                    : account.accountRole}
                                </span>
                              </div>
                            </div>
                            <Badge tone={account.status === "ACTIVE" ? "positive" : "negative"}>
                              {(ACCOUNT_KNOWN_STATUSES as readonly string[]).includes(
                                account.status,
                              )
                                ? t.trade[
                                    `accountStatus_${account.status as "ACTIVE" | "BLOCKED"}`
                                  ]
                                : account.status}
                            </Badge>
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                            <span className="font-semibold text-foreground">
                              {account.creditLimit === null ? (
                                t.trade.creditUnlimited
                              ) : (
                                <Money
                                  value={account.creditLimit}
                                  currency={account.creditCurrencyCode ?? undefined}
                                />
                              )}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspecting(account);
                                }}
                              >
                                <Eye className="size-3.5" aria-hidden="true" />
                              </Button>
                              {accounts.canManage && !accounts.writeScopeGap && (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    accounts.openEdit(account);
                                  }}
                                >
                                  <Pencil className="size-3.5" aria-hidden="true" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right-Side 360° Live Commercial Account Inspector */}
              {activeInspectorAccount && (
                <aside className="xl:col-span-4">
                  {(() => {
                    const role = isAccountRole(activeInspectorAccount.accountRole)
                      ? activeInspectorAccount.accountRole
                      : "CUSTOMER";
                    const palette = ACCOUNT_ROLE_PALETTES[role];
                    const visualTerms = parseVisualTerms(
                      JSON.stringify(activeInspectorAccount.terms ?? {}),
                    );
                    return (
                      <div
                        className={cn(
                          "sticky top-4 overflow-hidden rounded-lg border bg-card p-4 shadow-xs",
                          palette.cardBorderClass,
                        )}
                      >
                        <div
                          className={cn(
                            "-mx-4 -mt-4 mb-3.5 h-1.5",
                            palette.topAccentClass,
                          )}
                        />
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {copy.inspectorTitle}
                            </span>
                            <h3 className="mt-0.5 truncate text-xs font-semibold text-foreground">
                              <IdentifierText>{activeInspectorAccount.partyId}</IdentifierText>
                            </h3>
                          </div>
                          <Badge
                            tone={
                              activeInspectorAccount.status === "ACTIVE" ? "positive" : "negative"
                            }
                          >
                            {(ACCOUNT_KNOWN_STATUSES as readonly string[]).includes(
                              activeInspectorAccount.status,
                            )
                              ? t.trade[
                                  `accountStatus_${
                                    activeInspectorAccount.status as "ACTIVE" | "BLOCKED"
                                  }`
                                ]
                              : activeInspectorAccount.status}
                          </Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                            <span className="text-xs text-muted-foreground">
                              {t.trade.accountRole}
                            </span>
                            <p className="mt-0.5 font-semibold text-foreground">
                              {isAccountRole(activeInspectorAccount.accountRole)
                                ? t.trade[`accountRole_${activeInspectorAccount.accountRole}`]
                                : activeInspectorAccount.accountRole}
                            </p>
                          </div>
                          <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                            <span className="text-xs text-muted-foreground">
                              {t.trade.accountCreditLimit}
                            </span>
                            <p className="mt-0.5 font-semibold text-foreground">
                              {activeInspectorAccount.creditLimit === null ? (
                                t.trade.creditUnlimited
                              ) : (
                                <Money
                                  value={activeInspectorAccount.creditLimit}
                                  currency={
                                    activeInspectorAccount.creditCurrencyCode ?? undefined
                                  }
                                />
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2.5 rounded-md border border-border/60 bg-card p-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {t.trade.creditOrderingHold}
                            </span>
                            <Badge tone={visualTerms.orderingHold ? "caution" : "positive"}>
                              {visualTerms.orderingHold ? t.common.active : t.common.inactive}
                            </Badge>
                          </div>
                          {visualTerms.allowedCurrencies.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {visualTerms.allowedCurrencies.map((curr) => (
                                <span
                                  key={curr}
                                  dir="ltr"
                                  className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold"
                                >
                                  {curr}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                          <Button asChild variant="outline" size="xs" className="flex-1">
                            <Link
                              href={`${TENANT_ROUTES.tradeCommercialAccounts}/${activeInspectorAccount.id}`}
                            >
                              <CreditCard className="size-3.5" aria-hidden="true" />
                              {copy.creditAndBranchBtn}
                            </Link>
                          </Button>
                          {accounts.canManage && !accounts.writeScopeGap && (
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={() => accounts.openEdit(activeInspectorAccount)}
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                              {t.trade.accountEditTitle}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </aside>
              )}
            </div>
          </>
        )}

        <CreateAccountDrawer
          key={accounts.createOpen ? "create-open" : "create-closed"}
          isOpen={accounts.createOpen}
          isSubmitting={accounts.isSubmitting}
          error={accounts.formError}
          onClose={accounts.closeCreate}
          onSubmit={accounts.create}
        />

        {accounts.editing ? (
          <EditAccountDrawer
            key={accounts.editing.id}
            account={accounts.editing}
            isSubmitting={accounts.isSubmitting}
            error={accounts.formError}
            onClose={accounts.closeEdit}
            onSubmit={accounts.update}
          />
        ) : null}

        <AccountInspectModal
          account={inspecting}
          canManage={accounts.canManage && !accounts.writeScopeGap}
          onClose={() => setInspecting(null)}
          onEdit={(account) => accounts.openEdit(account)}
        />
      </div>
    </PermissionGate>
  );
}
