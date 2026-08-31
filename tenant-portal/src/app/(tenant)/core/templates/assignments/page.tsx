"use client";

import { ChevronLeft, ChevronRight, Pencil, RefreshCw, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmActionModal,
  DataTable,
  DegradedBanner,
  PageHeader,
  PermissionGate,
  SubNav,
  UnavailableState,
  CORE_TEMPLATE_NAV_ITEMS,
  type ColumnDef,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TEMPLATE_READ_PERMISSION } from "../templates-contract";
import type { TemplateAssignment } from "../template-assignments-contract";
import { AssignmentDrawer } from "./components/AssignmentDrawer";
import { ResolvePreviewPanel } from "./components/ResolvePreviewPanel";
import { useTemplateAssignments } from "./hooks/useTemplateAssignments";

export default function TemplateAssignmentsPage() {
  const assignments = useTemplateAssignments();
  const { t, lang } = assignments;
  const copy = t.coreOperations.templates;

  if (assignments.isEntitlementBlocked) {
    return <UnavailableState backHref={TENANT_ROUTES.core} />;
  }

  const columns: ColumnDef<TemplateAssignment>[] = [
    {
      id: "version",
      header: copy.assignmentVersion,
      cell: (assignment) => (
        <span className="flex flex-col">
          <span className="text-foreground">
            {formatTemplate(copy.versionLabel, { number: String(assignment.versionNumber) })}
          </span>
          <span className="text-xs text-muted-foreground">{assignment.adapterKey}</span>
        </span>
      ),
    },
    {
      id: "selector",
      header: copy.assignmentSelector,
      cell: (assignment) =>
        `${copy.documentTypes[assignment.documentType] ?? assignment.documentType} · ${
          copy.outputChannels[assignment.outputChannel] ?? assignment.outputChannel
        } · ${assignment.locale ?? copy.assignmentDefaultLocale}`,
    },
    {
      id: "priority",
      header: copy.assignmentPriority,
      numeric: true,
      cell: (assignment) => String(assignment.priority),
    },
    {
      id: "window",
      header: copy.assignmentWindow,
      cell: (assignment) =>
        `${formatDateTime(assignment.effectiveFrom, lang)} → ${
          assignment.effectiveTo
            ? formatDateTime(assignment.effectiveTo, lang)
            : copy.assignmentOpenEnded
        }`,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (assignment) => (
        <span className="flex items-center gap-1">
          <Badge tone={assignment.status === "ACTIVE" ? "positive" : "neutral"}>
            {copy.assignmentStatuses[assignment.status] ?? assignment.status}
          </Badge>
          {assignment.isDefault ? <Badge tone="brand">{copy.assignmentDefault}</Badge> : null}
        </span>
      ),
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (assignment) =>
        assignments.canManage ? (
          <span className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="xs"
              aria-label={`${copy.assignmentEditTitle}: ${assignment.versionNumber}`}
              disabled={assignments.pendingId !== null}
              onClick={() => assignments.openEdit(assignment)}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              aria-label={`${copy.assignmentDeactivate}: ${assignment.versionNumber}`}
              disabled={assignments.pendingId !== null}
              onClick={() => assignments.openDelete(assignment)}
            >
              <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <PermissionGate require={TEMPLATE_READ_PERMISSION}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={copy.assignmentsTitle}
          description={copy.assignmentsSubtitle}
          primaryAction={
            assignments.canManage
              ? { label: copy.assignmentCreate, onClick: assignments.openCreate }
              : undefined
          }
          secondaryActions={
            <Button variant="outline" onClick={assignments.reload} disabled={assignments.isLoading}>
              <RefreshCw
                className={assignments.isLoading ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.common.retry}
            </Button>
          }
        />

        <SubNav items={CORE_TEMPLATE_NAV_ITEMS} />

        {assignments.cursor.wasReset ? <DegradedBanner message={copy.cursorExpired} /> : null}

        <ResolvePreviewPanel
          resolved={assignments.resolved}
          isResolving={assignments.isResolving}
          onResolve={(selector) => void assignments.resolve(selector)}
        />

        <DataTable
          columns={columns}
          rows={assignments.items}
          isLoading={assignments.isLoading}
          error={assignments.error}
          onRetry={assignments.reload}
          rowKey={(assignment) => assignment.id}
          labels={{
            retry: t.common.retry,
            errorTitle: copy.assignmentsLoadFailed,
            emptyTitle: copy.assignmentsEmpty,
            selectAll: t.views.selectAll,
            selectRow: t.views.selectItem,
            sortAscending: t.views.sortAscending,
            sortDescending: t.views.sortDescending,
            notSorted: t.views.notSorted,
            pagination: {
              previous: t.common.previousPage,
              next: t.common.nextPage,
              summary: () => "",
            },
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {copy.pageIndicator} {assignments.cursor.pageNumber}
          </span>
          <span className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={assignments.goBack}
              disabled={!assignments.cursor.canGoBack || assignments.isLoading}
            >
              <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
              {t.common.previousPage}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={assignments.goNext}
              disabled={!assignments.hasNextPage || assignments.isLoading}
            >
              {t.common.nextPage}
              <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </Button>
          </span>
        </div>

        <AssignmentDrawer
          key={assignments.editing?.id ?? "assignment-create"}
          assignment={assignments.editing}
          isOpen={assignments.isCreateOpen || assignments.editing !== null}
          onClose={assignments.editing ? assignments.closeEdit : assignments.closeCreate}
          onSubmit={assignments.submit}
          isSubmitting={assignments.isSubmitting}
          error={assignments.formError}
        />

        <ConfirmActionModal
          open={assignments.deleting !== null}
          onOpenChange={(open) => {
            if (!open) assignments.closeDelete();
          }}
          title={copy.assignmentDeactivateTitle}
          description={copy.assignmentDeactivateDescription}
          confirmLabel={copy.assignmentDeactivate}
          cancelLabel={t.common.cancel}
          onConfirm={() => void assignments.remove()}
          loading={assignments.pendingId !== null}
        />
      </div>
    </PermissionGate>
  );
}
