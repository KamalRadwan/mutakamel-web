"use client";

import { Ban, Building2, Check, Pencil, Play, Plus, RotateCcw } from "lucide-react";
import { AmbiguousOutcomePanel, Button, cn, DegradedBanner, FormModal, StatusBadge, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { Activity, ActivityScope, ActivityTargetSelection, ActivityType } from "./activity-contract";
import { countModifiedActivityFields } from "./activity-form";
import {
  activitiesWorkspaceHref,
  activityCreateModalTitle,
  activityDueState,
  activityErrorMessage,
  activityLabel,
  activityTypePalette,
  computeOpenAgendaCounts,
  primaryActivityTarget,
} from "./activity-presentation";
import { ActivityAgenda } from "./ActivityAgenda";
import { ActivityDetails } from "./ActivityDetails";
import { ActivityForm } from "./ActivityForm";
import { ActivityOutcomeDialog } from "./ActivityOutcomeDialog";
import { ActivityTypeIcon } from "./ActivityTypeIcon";
import type { ActivityCommandKind } from "./hooks/useActivityCommands";
import {
  useActivityModalSession,
  useActivityModalState,
  type ActivityFormBlock,
  type ActivityModalSurfaceInput,
} from "./hooks/useActivityModalState";

export type ActivityModalRequest =
  | { kind: "create"; target?: ActivityTargetSelection; agenda?: boolean; defaults?: { type?: ActivityType; start?: Date } }
  /** The snapshot shows at once and is refreshed from `GET activities/:id`. */
  | { kind: "view"; activity: Activity }
  /** Straight into edit — a row's "Edit". */
  | { kind: "edit"; activity: Activity };

export interface ActivityModalProps {
  /** null = closed. */
  request: ActivityModalRequest | null;
  scope: ActivityScope;
  /** Narrows the record picker to one branch. */
  branchId?: string | null;
  onClose: () => void;
  /**
   * After any write that changed, or may have changed, an activity: with the
   * activity as Core now holds it, or null when that copy could not be read (a
   * save whose answer was lost, or an unknown outcome let go). Read again.
   */
  onChanged: (activity: Activity | null) => void;
}

type ActivityModalState = ReturnType<typeof useActivityModalState>;

/**
 * THE activity template — create, view and edit in one Split-Workspace
 * `FormModal`, used by every surface that shows activities.
 */
export function ActivityModal(props: ActivityModalProps) {
  const session = useActivityModalSession(props.request);
  if (!session.request) return null;
  return <ActivityModalSurface key={session.generation} {...props} request={session.request} open={session.open} />;
}

function ActivityModalSurface(props: ActivityModalSurfaceInput) {
  const { t } = useI18n();
  const copy = t.activities;
  const modal = useActivityModalState(props);
  const { screen, current, commands, can } = modal;
  const form = screen === "edit" ? modal.editForm : modal.createForm;
  const pending = commands.pendingKind;
  const ambiguous = commands.ambiguous;
  const target = current ? primaryActivityTarget(current) : null;
  const activeTarget =
    screen === "create"
      ? modal.fixedTarget ?? modal.createForm.values.target
      : target
        ? { app: "CRM" as const, type: target.targetType, id: target.targetId, label: target.label }
        : null;
  const recordName = activeTarget?.label;
  const viewing = screen === "view" && current !== null;

  const activeType = screen === "view" && current ? current.type : form.values.type;
  const palette = activityTypePalette(activeType);
  const modifiedCount =
    screen === "edit" ? countModifiedActivityFields(modal.editForm.values, modal.editForm.seed) : 0;
  const agendaCounts = computeOpenAgendaCounts(modal.agenda?.activities ?? []);
  const currentDueState = current ? activityDueState(current) : null;

  const title = viewing
    ? current.subject
    : screen === "edit" && current
      ? `${copy.form.editTitle} · ${current.subject}`
      : screen === "edit"
        ? copy.form.editTitle
        : activityCreateModalTitle(copy.title, recordName);

  const description = viewing
    ? copy.header.subtitleView
    : screen === "edit"
      ? copy.header.subtitleEdit
      : !modal.fixedTarget
        ? copy.header.subtitleStandalone
        : agendaCounts.total > 0
          ? copy.header.subtitlePopulated
          : copy.header.subtitleEmpty;

  const allowed = screen === "view" ? can.complete : screen === "edit" ? can.update : can.create;
  const detailError = screen !== "create" && modal.detailError ? activityErrorMessage(t, modal.detailError) : null;
  // "gone" needs no notice of its own: the detail read's error already says it.
  const blocks: Record<ActivityFormBlock, string | null> = {
    readOnly: copy.form.readOnly,
    notPermitted: screen === "create" ? copy.form.createNotPermitted : copy.form.editNotPermitted,
    terminal: copy.errors.ACTIVITY_TERMINAL,
    gone: null,
  };
  const blockNotice = modal.formBlock ? blocks[modal.formBlock] : null;
  const settled = ambiguous === null && !modal.applied;
  const operations: Record<ActivityCommandKind, string> = {
    create: copy.form.submitCreate,
    update: copy.form.submitEdit,
    start: copy.actions.start,
    moveBack: copy.actions.moveBack,
    complete: copy.actions.markDone,
    cancel: copy.actions.cancelActivity,
  };

  const fallbackActivity = current ?? modal.agenda?.activities[0] ?? null;
  const canSwitchToEdit =
    current !== null ? can.update : fallbackActivity !== null && can.row("update", fallbackActivity);
  const showModeSwitcher = modal.agenda !== null || current !== null;

  return (
    <>
      <FormModal
        open={modal.open}
        onOpenChange={(next) => {
          if (!next) modal.requestClose();
        }}
        size="wide"
        density="standard"
        title={title}
        description={description}
        headerIcon={
          screen === "edit" ? (
            <div className="flex size-11 items-center justify-center rounded-lg border border-warning/35 bg-warning-subtle text-warning-subtle-foreground">
              <Pencil className={iconSize({ size: "xl" })} aria-hidden="true" />
            </div>
          ) : (
            <div className={cn("flex size-11 items-center justify-center rounded-lg border", palette.iconBoxIdle)}>
              <ActivityTypeIcon type={activeType} size="xl" />
            </div>
          )
        }
        titleBadge={
          <div className="flex flex-wrap items-center gap-1.5">
            {activeTarget && (
              <span className="inline-flex items-center gap-1 rounded-md border border-info/30 bg-info-subtle px-2.5 py-0.5 text-xs font-semibold text-info-subtle-foreground">
                <Building2 className={iconSize({ size: "xs" })} aria-hidden="true" />
                {activityLabel(copy, "targetTypes", activeTarget.type)}
              </span>
            )}
            {screen === "create" && agendaCounts.overdue > 0 && (
              <span className="inline-flex items-center rounded-full border border-destructive/35 bg-destructive-subtle px-2 py-0.5 text-2xs font-semibold text-destructive-subtle-foreground">
                {formatTemplate(copy.header.overdueCount, { count: agendaCounts.overdue })}
              </span>
            )}
            {screen === "create" && agendaCounts.today > 0 && (
              <span className="inline-flex items-center rounded-full border border-warning/35 bg-warning-subtle px-2 py-0.5 text-2xs font-semibold text-warning-subtle-foreground">
                {formatTemplate(copy.header.todayCount, { count: agendaCounts.today })}
              </span>
            )}
            {screen === "create" && form.values.status === "DONE" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/35 bg-success-subtle px-2.5 py-0.5 text-xs font-semibold text-success-subtle-foreground">
                <Check className={iconSize({ size: "xs" })} aria-hidden="true" />
                {copy.header.filingCompleted}
              </span>
            )}
            {screen !== "create" && current && (
              <StatusBadge kind="ActivityStatus" value={current.status} />
            )}
            {viewing && currentDueState && currentDueState !== "UPCOMING" && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold",
                  currentDueState === "OVERDUE"
                    ? "border-destructive/35 bg-destructive-subtle text-destructive-subtle-foreground"
                    : "border-warning/35 bg-warning-subtle text-warning-subtle-foreground",
                )}
              >
                {copy.dueStates[currentDueState]}
              </span>
            )}
            {screen === "edit" && current && (
              <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning-subtle px-2.5 py-0.5 text-2xs font-semibold text-warning-subtle-foreground">
                <Pencil className={iconSize({ size: "xs" })} aria-hidden="true" />
                {copy.modes.editing} · v{current.version}
              </span>
            )}
            {screen === "edit" && modifiedCount > 0 && (
              <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning-subtle px-2 py-0.5 text-2xs font-semibold tabular-nums text-warning-subtle-foreground">
                {formatTemplate(copy.form.unsavedChanges, { count: modifiedCount })}
              </span>
            )}
          </div>
        }
        headerAside={
          showModeSwitcher ? (
            <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
              {(modal.agenda !== null || fallbackActivity !== null) && (
                <Button
                  type="button"
                  variant={screen === "view" ? "secondary" : "ghost"}
                  size="xs"
                  disabled={pending !== null}
                  onClick={() => {
                    if (fallbackActivity) modal.viewActivity(fallbackActivity);
                  }}
                  className={cn(
                    "h-7 gap-1.5 rounded-md px-2.5 text-xs font-semibold",
                    screen === "view"
                      ? "bg-card text-primary shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>{copy.modes.current}</span>
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular-nums",
                      agendaCounts.overdue > 0
                        ? "bg-destructive-subtle text-destructive-subtle-foreground"
                        : "bg-card text-muted-foreground",
                    )}
                  >
                    {agendaCounts.total}
                  </span>
                </Button>
              )}
              {fallbackActivity && canSwitchToEdit && (
                <Button
                  type="button"
                  variant={screen === "edit" ? "secondary" : "ghost"}
                  size="xs"
                  disabled={pending !== null}
                  onClick={() => (current ? modal.startEdit() : modal.editActivity(fallbackActivity))}
                  className={cn(
                    "h-7 gap-1 rounded-md px-2.5 text-xs font-semibold",
                    screen === "edit"
                      ? "border border-warning/40 bg-warning-subtle text-warning-subtle-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {copy.modes.edit}
                </Button>
              )}
              {can.create && (
                <Button
                  type="button"
                  variant={screen === "create" ? "secondary" : "ghost"}
                  size="xs"
                  disabled={pending !== null}
                  onClick={() => modal.startCreate()}
                  className={cn(
                    "h-7 gap-1 rounded-md px-2.5 text-xs font-semibold",
                    screen === "create"
                      ? "bg-card text-primary shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Plus className={iconSize({ size: "xs" })} aria-hidden="true" />
                  {copy.modes.new}
                </Button>
              )}
            </div>
          ) : undefined
        }
        asideSlot={
          modal.agenda ? (
            <ActivityAgenda
              variant="rail"
              records={modal.agenda}
              recordName={recordName}
              heading={copy.agenda.currentTitle}
              emptyLabel={copy.agenda.empty}
              errorLabel={copy.agenda.loadFailed}
              selectedId={screen === "view" ? current?.id ?? null : null}
              editingId={screen === "edit" ? current?.id ?? null : null}
              pendingId={commands.pendingActivityId}
              onView={modal.viewActivity}
              onEdit={modal.editActivity}
              onNew={screen !== "create" && can.create ? () => modal.startCreate() : undefined}
              onQuickType={can.create ? (type) => modal.startCreate(type) : undefined}
              viewAllHref={modal.fixedTarget ? activitiesWorkspaceHref(modal.fixedTarget) : null}
              canEdit={(activity) => can.row("update", activity)}
              canComplete={(activity) => can.row("complete", activity)}
              canCancel={(activity) => can.row("cancel", activity)}
              onComplete={(activity) => modal.outcome.start("complete", activity)}
              onCancel={(activity) => modal.outcome.start("cancel", activity)}
            />
          ) : undefined
        }
        isDirty={screen !== "view" && !modal.applied && form.isDirty}
        isSubmitting={pending === "create" || pending === "update"}
        onSubmit={() => void modal.submit()}
        error={commands.error ?? detailError ?? undefined}
        // Present only when the actor may perform it — absent, not disabled.
        hideSubmit={!allowed || !settled}
        submitIcon={<Check className={iconSize({ size: "xs" })} aria-hidden="true" />}
        submitClassName={
          viewing || (screen === "create" && form.values.status === "DONE")
            ? "bg-success text-primary-foreground hover:bg-success/90"
            : undefined
        }
        footerLeading={
          !settled ? undefined : viewing ? (
            <ViewActions modal={modal} activity={current} />
          ) : screen === "edit" ? (
            <span className="text-xs text-muted-foreground">{copy.form.editStatusHint}</span>
          ) : screen === "create" && can.create ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending !== null}
              onClick={(event) => modal.saveAndAddAnother(event.currentTarget.form)}
            >
              <Plus className={iconSize({ size: "xs" })} aria-hidden="true" />
              {copy.form.saveAndAddAnother}
            </Button>
          ) : undefined
        }
        labels={{
          submit:
            screen === "view"
              ? copy.actions.markDone
              : screen === "edit"
                ? copy.form.submitEdit
                : form.values.status === "DONE"
                  ? copy.form.logCompletedActivity
                  : copy.form.submitCreate,
          cancel:
            screen === "view"
              ? copy.form.close
              : screen === "edit" && modal.editFromView
                ? copy.form.cancelReturnToView
                : copy.form.cancel,
          discardTitle: t.common.discardTitle,
          discardDescription: t.common.discardDescription,
          discardConfirm: t.common.discardConfirm,
          discardCancel: t.common.cancel,
          // Required by FormModalLabels, drawn only by the `full` size's section index.
          sections: t.crmShared.formSectionsNav,
          sectionInvalid: t.crmShared.formSectionInvalid,
          close: copy.form.close,
        }}
      >
        {ambiguous ? (
          // The write may have applied. Its key is the only safe way forward,
          // so it stays on screen until the user retries or dismisses it.
          <AmbiguousOutcomePanel
            operation={operations[ambiguous.kind]}
            idempotencyKey={ambiguous.idempotencyKey}
            correlationId={ambiguous.correlationId}
            description={copy.ambiguous.description}
            onRetry={() => void modal.retry()}
            onDismiss={modal.dismissAmbiguous}
            retrying={pending !== null}
            labels={{
              title: copy.ambiguous.title,
              operation: copy.ambiguous.operation,
              idempotencyKey: copy.ambiguous.key,
              correlationId: copy.ambiguous.reference,
              retry: copy.ambiguous.retry,
              dismiss: t.common.dismiss,
            }}
          />
        ) : viewing ? (
          <ActivityDetails activity={current} actorId={modal.actorId} />
        ) : (
          <>
            {blockNotice && <DegradedBanner message={blockNotice} />}
            <ActivityForm
              form={form}
              mode={screen === "edit" ? "edit" : "create"}
              scope={props.scope}
              branchId={props.branchId}
              targetFixed={screen === "edit" || modal.fixedTarget !== null}
              statuses={modal.createStatuses}
              canAssign={can.assign}
              actorId={modal.actorId}
              actorName={modal.actorName}
              activity={screen === "edit" ? current : null}
              // Locked, not hidden, when it cannot be saved: the notice above says why.
              disabled={pending !== null || modal.applied || modal.formBlock !== null}
            />
          </>
        )}
      </FormModal>

      <ActivityOutcomeDialog
        open={modal.outcome.open}
        mode={modal.outcome.mode}
        activity={modal.outcome.activity}
        onClose={modal.outcome.close}
        onConfirm={(text) => void modal.outcome.confirm(text)}
        loading={modal.outcome.loading}
        error={modal.outcome.error}
      />
    </>
  );
}

/**
 * The view screen's lifecycle actions, beside the footer's one primary ("Mark
 * as done"). Each is present only when the actor may perform it on THIS
 * activity. Cancelling ends the activity, so it reads destructive.
 */
function ViewActions({ modal, activity }: { modal: ActivityModalState; activity: Activity }) {
  const { t } = useI18n();
  const copy = t.activities.actions;
  const { can } = modal;
  const pending = modal.commands.pendingKind;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {can.cancel && (
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/35 bg-destructive-subtle text-destructive-subtle-foreground hover:bg-destructive-subtle/80"
          disabled={pending !== null}
          onClick={() => modal.outcome.start("cancel", activity)}
        >
          <Ban className={iconSize({ size: "xs" })} aria-hidden="true" />
          {copy.cancelActivity}
        </Button>
      )}
      {can.update && activity.status === "PLANNED" && (
        <Button
          variant="outline"
          size="sm"
          className="border-warning/35 bg-warning-subtle text-warning-subtle-foreground hover:bg-warning-subtle/80"
          disabled={pending !== null}
          loading={pending === "start"}
          onClick={() => void modal.changeStatus("IN_PROGRESS")}
        >
          <Play className={iconSize({ size: "xs" })} aria-hidden="true" />
          {copy.start}
        </Button>
      )}
      {can.update && activity.status === "IN_PROGRESS" && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending !== null}
          loading={pending === "moveBack"}
          onClick={() => void modal.changeStatus("PLANNED")}
        >
          <RotateCcw className={iconSize({ size: "xs" })} aria-hidden="true" />
          {copy.moveBack}
        </Button>
      )}
      {can.update && (
        <Button
          variant="outline"
          size="sm"
          className="border-info/30 bg-info-subtle text-info-subtle-foreground hover:bg-info-subtle/80"
          disabled={pending !== null}
          onClick={modal.startEdit}
        >
          <Pencil className={iconSize({ size: "xs" })} aria-hidden="true" />
          {copy.edit}
        </Button>
      )}
    </div>
  );
}
