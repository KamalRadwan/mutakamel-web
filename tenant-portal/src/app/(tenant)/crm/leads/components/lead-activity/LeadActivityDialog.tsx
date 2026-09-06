"use client";

import { useState } from "react";
import { FormModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  EMPTY_LEAD_ACTIVITY_FORM,
  type LeadActivityForm,
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
export function LeadActivityDialog({ lead, onClose, onCreated }: LeadActivityDialogProps) {
  const { t } = useI18n();
  const copy = t.crmLeads.activities;
  const activities = useLeadActivities(lead?.id ?? null);
  const [values, setValues] = useState<LeadActivityForm>(EMPTY_LEAD_ACTIVITY_FORM);
  const [created, setCreated] = useState(false);

  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_LEAD_ACTIVITY_FORM);

  function change(patch: Partial<LeadActivityForm>) {
    // The confirmation belongs to the activity that was booked, not to the one
    // being typed next.
    setCreated(false);
    setValues((current) => ({ ...current, ...patch }));
  }

  async function submit() {
    if (!(await activities.create(values))) return;
    // The dialog stays open: the whole point of the leading half is that the
    // new activity appears in it, which a closed dialog cannot show.
    setValues(EMPTY_LEAD_ACTIVITY_FORM);
    setCreated(true);
    onCreated();
  }

  return (
    <FormModal
      open={lead !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={copy.title}
      description={lead ? formatTemplate(copy.description, { name: lead.name }) : undefined}
      size="card"
      isDirty={isDirty}
      isSubmitting={activities.isSubmitting}
      onSubmit={() => void submit()}
      error={activities.writeError ?? undefined}
      submitDisabled={!activities.canCreate}
      labels={{
        submit: copy.submit,
        cancel: t.common.close,
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
      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">{copy.openHeading}</h3>
          {/* The list scrolls inside its own half. Without the cap a lead with
              twenty booked calls would push the dialog past the viewport and
              hand the SURFACE a scrollbar, which scrolls the form away too. */}
          <div className="max-h-64 min-h-0 overflow-y-auto pe-1">
            <LeadActivityList
              activities={activities.activities}
              isLoading={activities.isLoading}
              error={activities.canRead ? activities.loadError : copy.readNotPermitted}
            />
          </div>
        </section>

        <section className="flex min-w-0 flex-col gap-2 md:border-s md:border-border md:ps-4">
          <h3 className="text-xs font-medium text-muted-foreground">{copy.createHeading}</h3>

          {/* Announced, not merely rendered: the new row appears in the other
              half, which a screen-reader user has no reason to be looking at.
              ui-ux-pro-max Forms/Submit Feedback, High. */}
          <p role="status" className="text-xs text-success-vivid empty:hidden">
            {created ? copy.created : ""}
          </p>

          {!activities.canCreate && (
            <p className="text-xs text-muted-foreground">{copy.createNotPermitted}</p>
          )}

          <LeadActivityCreateForm
            values={values}
            onChange={change}
            errors={activities.fieldErrors}
            disabled={activities.isSubmitting || !activities.canCreate}
          />
        </section>
      </div>
    </FormModal>
  );
}
