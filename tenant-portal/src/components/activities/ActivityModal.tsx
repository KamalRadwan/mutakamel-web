"use client";

import { Pencil } from "lucide-react";
import { AmbiguousOutcomePanel, Button, DegradedBanner, FormModal, StatusBadge, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { Activity, ActivityScope, ActivityTargetSelection, ActivityType } from "./activity-contract";
import { activityErrorMessage, activityLabel, primaryActivityTarget } from "./activity-presentation";
import { ActivityAgenda } from "./ActivityAgenda";
import { ActivityDetails } from "./ActivityDetails";
import { ActivityForm } from "./ActivityForm";
import { ActivityOutcomeDialog } from "./ActivityOutcomeDialog";
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
 * THE activity template — create, view and edit in one `FormModal`, used by
 * every surface that shows activities. One dialog root whose props change
 * with the screen, so moving between view and edit never flickers.
 */
export function ActivityModal(props: ActivityModalProps) {
  const session = useActivityModalSession(props.request);
  if (!session.request) return null;
  return <ActivityModalSurface key={session.generation} {...props} request={session.request} open={session.open} />;
}

function ActivityModalSurface(props: ActivityModalSurfaceInput) {
  const { t, lang } = useI18n();
  const copy = t.activities;
  const modal = useActivityModalState(props);
  const { screen, current, commands, can } = modal;
  const form = screen === "edit" ? modal.editForm : modal.createForm;
  const pending = commands.pendingKind;
  const ambiguous = commands.ambiguous;
  const target = current ? primaryActivityTarget(current) : null;
  const recordName = screen === "create" ? modal.fixedTarget?.label : target?.label;
  const viewing = screen === "view" && current !== null;

  const title = viewing ? current.subject : screen === "edit" ? copy.form.editTitle : copy.form.createTitle;
  const description = viewing
    ? [activityLabel(copy, "types", current.type), target?.label].filter(Boolean).join(" · ")
    : recordName ? formatTemplate(copy.form.recordDescription, { name: recordName }) : undefined;
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

  return (
    <>
      <FormModal
        open={modal.open}
        onOpenChange={(next) => {
          if (!next) modal.requestClose();
        }}
        size="card"
        title={title}
        description={description}
        headerAside={screen !== "create" && current ? <StatusBadge kind="ActivityStatus" value={current.status} /> : undefined}
        isDirty={screen !== "view" && !modal.applied && form.isDirty}
        isSubmitting={pending === "create" || pending === "update"}
        onSubmit={() => void modal.submit()}
        error={commands.error ?? detailError ?? undefined}
        // Present only when the actor may perform it — absent, not disabled.
        hideSubmit={!allowed || !settled}
        footerLeading={
          !settled ? undefined
            : viewing ? <ViewActions modal={modal} activity={current} />
            : screen === "create" && can.create ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending !== null}
                onClick={(event) => modal.saveAndAddAnother(event.currentTarget.form)}
              >
                {copy.form.saveAndAddAnother}
              </Button>
            ) : undefined
        }
        labels={{
          submit: screen === "view" ? copy.actions.markDone : screen === "edit" ? copy.form.submitEdit : copy.form.submitCreate,
          cancel: screen === "view" ? copy.form.close : copy.form.cancel,
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
            {screen === "create" && modal.agenda && (
              <ActivityAgenda
                records={modal.agenda}
                // A count is only claimed once the list has answered; an ellipsis holds its place until then.
                heading={formatTemplate(copy.agenda.title, {
                  count: modal.agenda.isLoading || modal.agenda.failed ? "…" : formatNumber(modal.agenda.activities.length, lang),
                })}
                emptyLabel={copy.agenda.empty}
                errorLabel={copy.agenda.loadFailed}
                canComplete={(activity) => can.row("complete", activity)}
                canCancel={(activity) => can.row("cancel", activity)}
                pendingId={commands.pendingActivityId}
                onView={modal.viewActivity}
                onComplete={(activity) => modal.outcome.start("complete", activity)}
                onCancel={(activity) => modal.outcome.start("cancel", activity)}
              />
            )}
            <ActivityForm
              form={form}
              mode={screen === "edit" ? "edit" : "create"}
              scope={props.scope}
              branchId={props.branchId}
              targetFixed={screen === "edit" || modal.fixedTarget !== null}
              statuses={modal.createStatuses}
              canAssign={can.assign}
              actorId={modal.actorId}
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
        <Button variant="outline" size="sm" className="text-destructive" disabled={pending !== null}
          onClick={() => modal.outcome.start("cancel", activity)}>
          {copy.cancelActivity}
        </Button>
      )}
      {can.update && activity.status === "PLANNED" && (
        <Button variant="outline" size="sm" disabled={pending !== null} loading={pending === "start"}
          onClick={() => void modal.changeStatus("IN_PROGRESS")}>
          {copy.start}
        </Button>
      )}
      {can.update && activity.status === "IN_PROGRESS" && (
        <Button variant="outline" size="sm" disabled={pending !== null} loading={pending === "moveBack"}
          onClick={() => void modal.changeStatus("PLANNED")}>
          {copy.moveBack}
        </Button>
      )}
      {can.update && (
        <Button variant="outline" size="sm" disabled={pending !== null} onClick={modal.startEdit}>
          <Pencil className={iconSize({ size: "sm" })} aria-hidden="true" />
          {copy.edit}
        </Button>
      )}
    </div>
  );
}
