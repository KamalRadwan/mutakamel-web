"use client";

import { useState } from "react";
import { Button, ConfirmActionModal, FormModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  EMPTY_LEAD_ACTIVITY_FORM,
  leadActivityToForm,
  type LeadActivityForm,
  type LeadPlannedActivity,
} from "../../lead-activity-contract";
import { useLeadActivities } from "../../hooks/useLeadActivities";
import { LeadActivityCreateForm } from "./LeadActivityCreateForm";
import { LeadActivityList } from "./LeadActivityList";

/** Only the two fields the dialog needs, so a list reload cannot leave it stale. */
export interface LeadActivityTarget {
  id: string;
  name: string;
}

export interface LeadActivityDialogProps {
  /** `null` is closed. Mount under a namespaced per-lead key, `activity-${lead?.id ?? "closed"}`,
   * so each lead starts clean and the closed key cannot collide with a sibling dialog's. */
  lead: LeadActivityTarget | null;
  onClose: () => void;
  /** A booked activity changes the card's next-activity bucket, and its colour with it. */
  onCreated: () => void;
  /** Opens a row selected in the detail rail directly in edit mode. Key by row/version. */
  initialActivity?: LeadPlannedActivity;
  density?: "standard" | "compact";
}

/**
 * The card's activity mark, opened.
 *
 * Two halves of equal width: what is already planned on this lead, and the
 * form that adds one more. They are a two-column grid from `md` up and a
 * single stacked column below it — squeezing a five-field form into half a
 * phone screen is how a dialog earns a horizontal scrollbar, and both halves
 * carry `min-w-0` so a long subject shrinks its column instead of widening the
 * grid.
 *
 * `FormModal` at `size="card"` rather than a bare `Dialog`: the trailing half
 * is a create form, and the modal is what makes it a real `<form noValidate>`
 * — Enter submits, the dirty guard covers all four dismissal routes, and focus
 * lands on the first invalid field after a rejected submit. Rebuilding those
 * around a raw `Dialog` is how a second surface gets them subtly wrong.
 */
export function LeadActivityDialog({ lead, onClose, onCreated, initialActivity, density = "standard" }: LeadActivityDialogProps) {
  const { t } = useI18n();
  const copy = t.crmLeads.activities;
  const activities = useLeadActivities(lead?.id ?? null);
  const [values, setValues] = useState<LeadActivityForm>(() =>
    initialActivity ? leadActivityToForm(initialActivity) : EMPTY_LEAD_ACTIVITY_FORM);
  const [created, setCreated] = useState(false);
  // The row the form half is editing, or null while it adds. The whole ROW is
  // held rather than its id: the version travels with it as `If-Match`, and so
  // does the due date the validator needs to know has not moved.
  const [editing, setEditing] = useState<LeadPlannedActivity | null>(initialActivity ?? null);
  // Held separately from `editing` so the confirmation can name the row while
  // the menu that opened it has already closed.
  const [discarding, setDiscarding] = useState<LeadPlannedActivity | null>(null);

  // Against the form's own starting point, which is the empty form when adding
  // and the row's own values when editing — so an edit nobody has touched is
  // not dirty, and the discard guard stays quiet on the way out.
  const baseline = editing ? leadActivityToForm(editing) : EMPTY_LEAD_ACTIVITY_FORM;
  const isDirty = JSON.stringify(values) !== JSON.stringify(baseline);

  function change(patch: Partial<LeadActivityForm>) {
    // The confirmation belongs to the activity that was booked, not to the one
    // being typed next.
    setCreated(false);
    setValues((current) => ({ ...current, ...patch }));
  }

  function leaveEditing() {
    setEditing(null);
    setValues(EMPTY_LEAD_ACTIVITY_FORM);
  }

  function startEditing(activity: LeadPlannedActivity) {
    setCreated(false);
    setEditing(activity);
    setValues(leadActivityToForm(activity));
  }

  async function submit() {
    if (editing) {
      if (!(await activities.update(editing, values))) return;
      // Back to adding. The row is in the list beside this, already carrying
      // the new subject and time, so repeating it in the form would be a
      // second copy of an answer the user can see.
      leaveEditing();
      onCreated();
      return;
    }
    if (!(await activities.create(values))) return;
    // The dialog stays open: the whole point of the leading half is that the
    // new activity appears in it, which a closed dialog cannot show.
    setValues(EMPTY_LEAD_ACTIVITY_FORM);
    setCreated(true);
    onCreated();
  }

  /**
   * Save, then complete — two writes, and the second only if the first landed.
   *
   * `update` answers with the SAVED row because the save moved its version,
   * and the completion's `If-Match` needs the new one. Reading it back out of
   * the list state would read the version from before the save: React has not
   * re-rendered, and the reload the save triggered is still in flight.
   */
  async function saveAndMarkDone() {
    if (!editing) return;
    const saved = await activities.update(editing, values);
    if (!saved) return;
    if (!(await activities.complete(saved))) return;
    leaveEditing();
    onCreated();
  }

  async function markDone(activity: LeadPlannedActivity) {
    if (!(await activities.complete(activity))) return;
    if (editing?.id === activity.id) leaveEditing();
    onCreated();
  }

  async function confirmDiscard() {
    if (!discarding) return;
    const target = discarding;
    setDiscarding(null);
    if (!(await activities.cancel(target))) return;
    if (editing?.id === target.id) leaveEditing();
    onCreated();
  }

  return (
    <>
    <FormModal
      open={lead !== null}
      onOpenChange={(next) => {
        if (next) return;
        // In edit mode the trailing button IS the edit's Cancel, so it leaves
        // the mode rather than the dialog — and so do Escape and the backdrop,
        // which is the same "get out of the sub-mode first" the button reads
        // as. The dialog's own Close is one more press away, and the list the
        // dialog exists to show stays on screen in between.
        if (editing) {
          leaveEditing();
          return;
        }
        onClose();
      }}
      title={copy.title}
      description={lead ? formatTemplate(copy.description, { name: lead.name }) : undefined}
      size="card"
      density={density}
      isDirty={isDirty}
      isSubmitting={activities.isSubmitting}
      onSubmit={() => void submit()}
      error={activities.writeError ?? undefined}
      submitDisabled={editing ? !activities.canUpdate : !activities.canCreate}
      // Edit mode's third button. It sits at the footer's inline start, so the
      // three read Save and mark as done · Cancel · Save.
      footerLeading={
        editing && activities.canComplete ? (
          <Button
            type="button"
            variant="outline"
            size={density === "compact" ? "sm" : "md"}
            disabled={activities.isSubmitting || !activities.canUpdate}
            onClick={() => void saveAndMarkDone()}
          >
            {copy.saveAndMarkDone}
          </Button>
        ) : undefined
      }
      labels={{
        submit: editing ? copy.save : copy.submit,
        cancel: editing ? copy.cancelEdit : t.common.close,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        // Required by FormModalLabels, rendered only by the `full` size's
        // section index — which this dialog, having no sections, never shows.
        sections: t.crmLeads.create.sectionsNav,
        sectionInvalid: t.crmLeads.create.sectionInvalid,
        close: t.common.close,
      }}
    >
      <div className={density === "compact" ? "grid gap-2 md:grid-cols-2" : "grid gap-4 md:grid-cols-2"}>
        <section className="flex min-w-0 flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">{copy.openHeading}</h3>
          {/* The list scrolls inside its own half. Without the cap a lead with
              twenty booked calls would push the dialog past the viewport and
              hand the SURFACE a scrollbar, which scrolls the form away too. */}
          <div className="max-h-64 min-h-0 overflow-y-auto pe-1">
            <LeadActivityList
              density={density}
              activities={activities.activities}
              isLoading={activities.isLoading}
              error={activities.canRead ? activities.loadError : copy.readNotPermitted}
              canEdit={activities.canUpdate}
              canComplete={activities.canComplete}
              canDiscard={activities.canCancel}
              editingId={editing?.id ?? null}
              pendingId={activities.pendingActivityId}
              onEdit={startEditing}
              onComplete={(activity) => void markDone(activity)}
              // Confirmed, not immediate: the row leaves this list either way,
              // and a menu item that is one press from the one above it should
              // not be the last word on a state change other people can see.
              onDiscard={setDiscarding}
            />
          </div>
        </section>

        <section className={`flex min-w-0 flex-col gap-2 md:border-s md:border-border ${density === "compact" ? "md:ps-2" : "md:ps-4"}`}>
          {/* One half, two modes. The heading is what says which — the fields
              below are identical, and a form that silently changed what Save
              means is how an edit gets filed as a second activity. */}
          <h3 className="text-xs font-medium text-muted-foreground">
            {editing ? copy.editHeading : copy.createHeading}
          </h3>
          {editing && (
            <p className="text-xs text-info-subtle-foreground">
              {formatTemplate(copy.editingSubject, { subject: editing.subject })}
            </p>
          )}

          {/* Announced, not merely rendered: the new row appears in the other
              half, which a screen-reader user has no reason to be looking at.
              ui-ux-pro-max Forms/Submit Feedback, High. */}
          <p role="status" className="text-xs text-success-vivid empty:hidden">
            {created ? copy.created : ""}
          </p>

          {!editing && !activities.canCreate && (
            <p className="text-xs text-muted-foreground">{copy.createNotPermitted}</p>
          )}

          <LeadActivityCreateForm
            density={density}
            values={values}
            onChange={change}
            errors={activities.fieldErrors}
            disabled={
              activities.isSubmitting || (editing ? !activities.canUpdate : !activities.canCreate)
            }
          />
        </section>
      </div>
    </FormModal>

    {/* Outside the FormModal, not inside it: an AlertDialog nested in a Dialog
        inherits that dialog's focus trap, and dismissing the inner one would
        hand focus back to a trigger the menu has already unmounted. */}
    <ConfirmActionModal
      open={discarding !== null}
      onOpenChange={(next) => {
        if (!next) setDiscarding(null);
      }}
      title={copy.discardTitle}
      description={copy.discardDescription}
      confirmLabel={copy.discardConfirm}
      cancelLabel={t.common.cancel}
      loading={activities.isSubmitting}
      onConfirm={() => void confirmDiscard()}
    />
    </>
  );
}
