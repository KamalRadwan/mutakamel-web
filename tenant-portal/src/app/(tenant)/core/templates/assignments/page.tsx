"use client";

import { ChevronLeft, ChevronRight, Pencil, RefreshCw, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmActionModal,
  DataTable,
  DegradedBanner,
  IdentifierText,
  PageHeader,
  PermissionGate,
  SubNav,
  UnavailableState,
  CORE_TEMPLATE_NAV_ITEMS,
  type ColumnDef,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TEMPLATE_READ_PERMISSION } from "../templates-contract";
import { assignmentScopeKey, isSalesQuotationSelector, type AssignmentScope, type TemplateAssignment } from "../template-assignments-contract";
import { useTemplateAuthority } from "../hooks/useTemplateAuthority";
import { AssignmentDrawer } from "./components/AssignmentDrawer";
import { AssignmentScopeFields } from "./components/AssignmentScopeFields";
import { ResolvePreviewPanel } from "./components/ResolvePreviewPanel";
import { useAssignmentScope } from "./hooks/useAssignmentScope";
import { useTemplateAssignments } from "./hooks/useTemplateAssignments";

export default function TemplateAssignmentsPage() {
  const authority = useTemplateAuthority();
  const { t } = useI18n();
  return authority.key ? (
    <AssignmentScopeWorkspace key={authority.key} authority={authority.key} readAuthority={authority.readCurrent} />
  ) : (
    <PermissionGate require={TEMPLATE_READ_PERMISSION}>
      <div className="flex flex-wrap items-center gap-2">
        <DegradedBanner message={t.coreOperations.templates.assignmentsLoadFailed} />
        <Button size="sm" variant="outline" onClick={() => void authority.retry()}
          disabled={!authority.canRetry} loading={authority.recovering}>{t.common.retry}</Button>
      </div>
    </PermissionGate>
  );
}

function AssignmentScopeWorkspace({ authority, readAuthority }: {
  authority: string;
  readAuthority: () => string | null;
}) {
  const selection = useAssignmentScope();
  const { scope } = selection;
  return (
    <PermissionGate require={TEMPLATE_READ_PERMISSION} denied={selection.types.length === 0}>
      <div className="flex flex-col gap-4">
        <SubNav items={CORE_TEMPLATE_NAV_ITEMS} />
        <AssignmentScopeFields selection={selection} />
        {scope ? (
          <AssignmentWorkspace key={assignmentScopeKey(scope)} scope={scope}
            authority={authority} readAuthority={readAuthority} />
        ) : null}
      </div>
    </PermissionGate>
  );
}

function AssignmentWorkspace({ scope, authority, readAuthority }: {
  scope: AssignmentScope;
  authority: string;
  readAuthority: () => string | null;
}) {
  const assignments = useTemplateAssignments(scope, authority, readAuthority);
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
            {formatTemplate(copy.versionLabel, { number: formatNumber(assignment.versionNumber, lang) })}
          </span>
          <span className="text-xs text-muted-foreground">{assignment.adapterKey}</span>
          {isSalesQuotationSelector(assignment) ? (
            <>
              <span className="text-xs text-muted-foreground">
                {copy.definitionTitle} <IdentifierText selectAll>{assignment.definitionId}</IdentifierText>
              </span>
              <span className="text-xs text-muted-foreground">
                {copy.assignmentVersionId} <IdentifierText selectAll>{assignment.versionId}</IdentifierText>
              </span>
            </>
          ) : null}
        </span>
      ),
    },
    {
      id: "selector",
      header: copy.assignmentSelector,
      cell: (assignment) =>
        `${copy.documentTypes[assignment.documentType] ?? assignment.documentType} · ${
          copy.outputChannels[assignment.outputChannel] ?? assignment.outputChannel
        } · ${assignment.locale ? copy.locales[assignment.locale as keyof typeof copy.locales] ?? assignment.locale : copy.assignmentDefaultLocale}`,
    },
    {
      id: "priority",
      header: copy.assignmentPriority,
      numeric: true,
      cell: (assignment) => formatNumber(assignment.priority, lang),
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
    <PermissionGate require={TEMPLATE_READ_PERMISSION} denied={assignments.error?.status === 403}>
      <div className="flex flex-col gap-4">
        <PageHeader className="sr-only"
          title={copy.assignmentsTitle}
          description={copy.assignmentsSubtitle}
          primaryAction={
            assignments.canManage
              ? { label: copy.assignmentCreate, onClick: assignments.openCreate }
              : undefined
          }
          secondaryActions={
            <Button size="sm" variant="outline" onClick={assignments.reload} disabled={assignments.isLoading}>
              <RefreshCw
                className={assignments.isLoading ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.common.retry}
            </Button>
          }
        />

        {assignments.cursor.wasReset ? <DegradedBanner message={copy.cursorExpired} /> : null}

        <ResolvePreviewPanel
          selector={assignments.selector}
          resolved={assignments.resolved}
          isResolving={assignments.isResolving}
          onChange={assignments.changeSelector}
          onResolve={() => void assignments.resolve()}
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
            {copy.pageIndicator} {formatNumber(assignments.cursor.pageNumber, lang)}
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

        {assignments.isCreateOpen || assignments.editing ? (
          <AssignmentDrawer
            key={assignments.editing?.id ?? "assignment-create"}
            assignment={assignments.editing}
            scope={scope}
            onClose={assignments.editing ? assignments.closeEdit : assignments.closeCreate}
            onSubmit={assignments.submit}
            isSubmitting={assignments.isSubmitting}
            error={assignments.formError}
            isCurrent={assignments.canWrite}
          />
        ) : null}

        <ConfirmActionModal
          open={assignments.deleting !== null}
          onOpenChange={(open) => {
            if (!open) assignments.closeDelete();
          }}
          title={copy.assignmentDeactivateTitle}
          description={assignments.deleteOutcome === "conflict" ? copy.assignmentDeactivateConflict
            : assignments.deleteOutcome === "check" ? copy.assignmentDeactivateCheck
              : assignments.deleteOutcome === "uncertain" ? copy.assignmentDeactivateUncertain : copy.assignmentDeactivateDescription}
          confirmLabel={assignments.deleteOutcome === "conflict" ? copy.conflictReload
            : assignments.deleteOutcome === "check" ? copy.assignmentCheckStatus
              : assignments.deleteOutcome === "uncertain" ? t.common.retry : copy.assignmentDeactivate}
          cancelLabel={t.common.cancel}
          onConfirm={() => void assignments.remove()}
          loading={assignments.pendingId !== null}
        />
      </div>
    </PermissionGate>
  );
}
