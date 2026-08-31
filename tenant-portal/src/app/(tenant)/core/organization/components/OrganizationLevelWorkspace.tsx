"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Button,
  ConfirmActionModal,
  CORE_IDENTITY_NAV_ITEMS,
  DataTable,
  DeletionBlockerDialog,
  FilterBar,
  FormDrawer,
  PageHeader,
  PermissionGate,
  SubNav,
} from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import {
  ORG_NODE_STATUSES,
  type OrgLevel,
  type OrgNodeOf,
  type OrgNodeStatus,
} from "../../contracts/organization-contract";
import { useCoreErrorText } from "../../hooks/useCoreErrorText";
import { useOrgNodeOptions, useTenantUserOptions } from "../../hooks/useCoreOptions";
import {
  EMPTY_ORG_NODE_FORM,
  useOrganizationLevel,
  type OrgNodeFormValues,
} from "../hooks/useOrganizationLevel";
import { OrganizationNodeForm } from "./OrganizationNodeForm";
import { useOrganizationColumns } from "./useOrganizationColumns";

/** Narrows a `FilterBar` string back to the wire enum; anything else clears it. */
function readOrgStatus(value: string): OrgNodeStatus | undefined {
  return ORG_NODE_STATUSES.find((status) => status === value);
}

export function OrganizationLevelWorkspace<L extends OrgLevel>({ level }: { level: L }) {
  const screen = useOrganizationLevel(level);
  const { t, config, canManage } = screen;
  const copy = t.coreIdentity;
  const levelCopy = copy.levels[level];
  const describeError = useCoreErrorText();

  const [form, setForm] = useState<OrgNodeFormValues>(EMPTY_ORG_NODE_FORM);
  const [baseline, setBaseline] = useState<OrgNodeFormValues>(EMPTY_ORG_NODE_FORM);
  const parentOptions = useOrgNodeOptions(config.parent ?? "companies", {
    enabled: Boolean(config.parent),
  });
  const leadUserOptions = useTenantUserOptions(config.fields.includes("leadUserId"));

  const patch = (next: Partial<OrgNodeFormValues>) =>
    setForm((current) => ({ ...current, ...next }));

  function openCreate() {
    setForm(EMPTY_ORG_NODE_FORM);
    setBaseline(EMPTY_ORG_NODE_FORM);
    screen.openCreate();
  }

  function openEdit(node: OrgNodeOf<L>) {
    const next: OrgNodeFormValues = {
      ...EMPTY_ORG_NODE_FORM,
      code: node.code,
      name: node.name,
      status: node.status,
      legalName: "legalName" in node ? (node.legalName ?? "") : "",
      taxNumber: "taxNumber" in node ? (node.taxNumber ?? "") : "",
      currencyCode: "currencyCode" in node ? (node.currencyCode ?? "") : "",
      address: "address" in node ? (node.address ?? "") : "",
      phone: "phone" in node ? (node.phone ?? "") : "",
      isHeadquarters: "isHeadquarters" in node ? node.isHeadquarters : false,
      leadUserId: "leadUserId" in node ? (node.leadUserId ?? "") : "",
    };
    setForm(next);
    setBaseline(next);
    screen.startEdit(node);
  }

  const columns = useOrganizationColumns<L>({
    config,
    canManage,
    onEdit: openEdit,
    onDelete: screen.requestDelete,
  });

  const mutationText = describeError(screen.mutationError);
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline);

  return (
    <PermissionGate require={config.readPermission}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={levelCopy.title}
          description={levelCopy.subtitle}
          primaryAction={canManage ? { label: levelCopy.add, onClick: openCreate } : undefined}
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
              id: "status",
              kind: "select",
              label: copy.fields.status,
              options: [
                { value: "ACTIVE", label: copy.orgStatus.ACTIVE },
                { value: "INACTIVE", label: copy.orgStatus.INACTIVE },
              ],
              placeholder: copy.filters.anyStatus,
            },
          ]}
          values={
            screen.statusFilter
              ? { status: { kind: "select", value: screen.statusFilter } }
              : {}
          }
          onChange={(next) => {
            const value = next.status;
            screen.setStatusFilter(
              value?.kind === "select" ? readOrgStatus(value.value) : undefined,
            );
            screen.setPage(1);
          }}
          onReset={() => {
            screen.setStatusFilter(undefined);
            screen.setPage(1);
          }}
          searchValue={screen.searchQuery}
          onSearchChange={screen.setSearchQuery}
          searchPlaceholder={levelCopy.searchPlaceholder}
          filtersLabel={t.filters.label}
          clearAllLabel={t.filters.clearAll}
        />

        {mutationText && !screen.isCreateOpen && !screen.editing ? (
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
          rowKey={(node) => node.id}
          labels={{
            retry: t.common.retry,
            errorTitle: levelCopy.loadFailed,
            emptyTitle: levelCopy.empty,
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

        <FormDrawer
          open={screen.isCreateOpen || screen.editing !== null}
          onOpenChange={(open) => {
            if (open) return;
            screen.closeCreate();
            screen.cancelEdit();
            screen.clearMutationError();
          }}
          title={screen.editing ? levelCopy.editTitle : levelCopy.addTitle}
          description={screen.editing ? undefined : levelCopy.addDescription}
          isDirty={isDirty}
          isSubmitting={screen.isSubmitting}
          onSubmit={() => {
            void (screen.editing ? screen.handleUpdate(form) : screen.handleCreate(form));
          }}
          error={mutationText}
          submitDisabled={
            form.name.trim().length === 0 ||
            (!screen.editing && form.code.trim().length === 0) ||
            (!screen.editing && Boolean(config.parent) && form.parentId.length === 0)
          }
          labels={{
            submit: t.common.save,
            cancel: t.common.cancel,
            discardTitle: t.common.discardTitle,
            discardDescription: t.common.discardDescription,
            discardConfirm: t.common.discardConfirm,
            discardCancel: t.common.cancel,
          }}
        >
          <OrganizationNodeForm
            config={config}
            values={form}
            onChange={patch}
            mode={screen.editing ? "edit" : "create"}
            isSubmitting={screen.isSubmitting}
            parentOptions={parentOptions}
            leadUserOptions={leadUserOptions}
          />
        </FormDrawer>

        <ConfirmActionModal
          open={screen.pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) screen.cancelDelete();
          }}
          title={levelCopy.deleteTitle}
          description={formatTemplate(levelCopy.deleteMessage, {
            name: screen.pendingDelete?.name ?? "",
          })}
          confirmLabel={t.common.delete}
          cancelLabel={t.common.cancel}
          onConfirm={() => void screen.handleDelete()}
          loading={screen.isSubmitting}
        />

        <DeletionBlockerDialog
          open={screen.blockedNode !== null}
          onOpenChange={(open) => {
            if (!open) screen.dismissBlockers();
          }}
          recordName={screen.blockedNode?.name ?? ""}
          blockers={screen.blockers.map((blocker) => ({ id: blocker, label: blocker }))}
          labels={{
            title: t.deletionBlocker.title,
            description: t.deletionBlocker.description,
            blockersHeading: t.deletionBlocker.blockersHeading,
            view: t.deletionBlocker.view,
            close: t.deletionBlocker.close,
          }}
        />
      </div>
    </PermissionGate>
  );
}
