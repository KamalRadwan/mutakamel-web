"use client";

import Link from "next/link";
import { RefreshCw, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmActionModal,
  CORE_IDENTITY_NAV_ITEMS,
  DataTable,
  FilterBar,
  PageHeader,
  PermissionGate,
  SubNav,
  type ColumnDef,
} from "@/design-system";
import { localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { TenantRole } from "../contracts/role-contract";
import { useCoreErrorText } from "../hooks/useCoreErrorText";
import { RoleFormDrawer } from "./components/RoleFormDrawer";
import { useTenantRoles } from "./hooks/useTenantRoles";

export default function TenantRolesPage() {
  const screen = useTenantRoles();
  const { t, lang } = screen;
  const copy = t.coreIdentity.roles;
  const describeError = useCoreErrorText();
  const mutationText = describeError(screen.mutationError);

  const columns: ColumnDef<TenantRole>[] = [
    {
      id: "name",
      sortable: true,
      header: copy.name,
      cell: (role) => (
        <div className="flex items-center gap-1.5">
          <Link
            href={`${TENANT_ROUTES.coreRoles}/${role.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {localizedValue(role.nameAr, role.nameEn, lang)}
          </Link>
          {role.isSystem ? <Badge tone="brand">{copy.systemRole}</Badge> : null}
        </div>
      ),
    },
    {
      id: "description",
      header: copy.description,
      cell: (role) => localizedValue(role.descriptionAr, role.descriptionEn, lang),
    },
    ...(screen.canDelete
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (role: TenantRole) =>
              role.isSystem ? (
                <span className="text-2xs text-muted-foreground">{copy.readOnly}</span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => screen.requestDelete(role)}
                  aria-label={`${t.common.delete}: ${localizedValue(role.nameAr, role.nameEn, lang)}`}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <PermissionGate require="roles.role.read">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={copy.title}
          description={copy.subtitle}
          primaryAction={
            screen.canCreate ? { label: copy.create, onClick: screen.openCreate } : undefined
          }
          secondaryActions={
            <Button variant="outline" onClick={screen.reload} disabled={screen.isLoading}>
              <RefreshCw
                className={`size-4 ${screen.isLoading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {t.common.retry}
            </Button>
          }
        />

        <SubNav items={CORE_IDENTITY_NAV_ITEMS} />

        <FilterBar
          filters={[
            {
              id: "isSystem",
              kind: "select",
              label: copy.systemFilter,
              options: [
                { value: "true", label: copy.systemOnly },
                { value: "false", label: copy.customOnly },
              ],
              placeholder: copy.allRoles,
            },
          ]}
          values={
            screen.isSystemFilter === undefined
              ? {}
              : { isSystem: { kind: "select", value: String(screen.isSystemFilter) } }
          }
          onChange={(next) => {
            const value = next.isSystem;
            if (value?.kind !== "select") {
              screen.setIsSystemFilter(undefined);
              return;
            }
            screen.setIsSystemFilter(value.value === "true" ? true : value.value === "false" ? false : undefined);
          }}
          onReset={() => screen.setIsSystemFilter(undefined)}
          searchValue={screen.searchQuery}
          onSearchChange={screen.setSearchQuery}
          searchPlaceholder={copy.searchPlaceholder}
          filtersLabel={t.filters.label}
          clearAllLabel={t.filters.clearAll}
        />

        {mutationText && !screen.isCreateOpen ? (
          <p
            role="alert"
            className="rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300"
          >
            {mutationText}
          </p>
        ) : null}

        <DataTable
          columns={columns}
          rows={screen.rows}
          isLoading={screen.isLoading}
          error={screen.queryError}
          onRetry={screen.reload}
          page={screen.pageInfo}
          onPageChange={screen.setPage}
          sort={screen.sort}
          onSortChange={screen.setSort}
          rowKey={(role) => role.id}
          labels={{
            retry: t.common.retry,
            errorTitle: copy.loadFailed,
            emptyTitle: copy.empty,
            selectAll: t.views.selectAll,
            selectRow: t.views.selectItem,
            sortAscending: t.views.sortAscending,
            sortDescending: t.views.sortDescending,
            notSorted: t.views.notSorted,
            pagination: {
              previous: t.common.previousPage,
              next: t.common.nextPage,
              summary: (from, to, total) =>
                formatTemplate(t.common.showingOf, { from, to, total }),
            },
          }}
        />

        <RoleFormDrawer
          key={screen.isCreateOpen ? "open" : "closed"}
          isOpen={screen.isCreateOpen}
          initial={{ name: "", description: "" }}
          title={copy.createTitle}
          description={copy.createDescription}
          onClose={screen.closeCreate}
          onSubmit={screen.handleCreate}
          isSubmitting={screen.isSubmitting}
          error={screen.isCreateOpen ? mutationText : undefined}
        />

        <ConfirmActionModal
          open={screen.pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) screen.cancelDelete();
          }}
          title={copy.deleteTitle}
          description={formatTemplate(copy.deleteMessage, {
            name: screen.pendingDelete
              ? localizedValue(screen.pendingDelete.nameAr, screen.pendingDelete.nameEn, lang)
              : "",
          })}
          confirmLabel={t.common.delete}
          cancelLabel={t.common.cancel}
          onConfirm={() => void screen.handleDelete()}
          loading={screen.isSubmitting}
        />
      </div>
    </PermissionGate>
  );
}
