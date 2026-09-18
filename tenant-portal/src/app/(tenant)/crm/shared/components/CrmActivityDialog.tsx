"use client";

import { useState } from "react";
import {
  Button,
  ConfirmActionModal,
  Field,
  FormModal,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  CRM_ACTIVITY_DESCRIPTION_MAX,
  CRM_ACTIVITY_PRIORITIES,
  CRM_ACTIVITY_SUBJECT_MAX,
  CRM_ACTIVITY_TYPES,
  EMPTY_CRM_ACTIVITY_FORM,
  crmActivityToForm,
  type CrmActivityForm,
  type CrmActivityTarget,
  type CrmPlannedActivity,
} from "../crm-activity-contract";
import { useCrmActivities } from "../hooks/useCrmActivities";
import { CrmActivityList } from "./CrmActivityList";

export interface CrmActivityDialogProps {
  target: CrmActivityTarget | null;
  onClose: () => void;
  onCreated: () => void;
  initialActivity?: CrmPlannedActivity;
  density?: "standard" | "compact";
}

export function CrmActivityDialog({
  target,
  onClose,
  onCreated,
  initialActivity,
  density = "standard",
}: CrmActivityDialogProps) {
  const { t } = useI18n();
  const copy = t.crmLeads.activities;
  const activities = useCrmActivities(target?.id ?? null, target?.targetType ?? "LEAD");

  const [values, setValues] = useState<CrmActivityForm>(() =>
    initialActivity ? crmActivityToForm(initialActivity) : EMPTY_CRM_ACTIVITY_FORM,
  );
  const [created, setCreated] = useState(false);
  const [editing, setEditing] = useState<CrmPlannedActivity | null>(initialActivity ?? null);
  const [discarding, setDiscarding] = useState<CrmPlannedActivity | null>(null);

  const baseline = editing ? crmActivityToForm(editing) : EMPTY_CRM_ACTIVITY_FORM;
  const isDirty = JSON.stringify(values) !== JSON.stringify(baseline);

  function change(patch: Partial<CrmActivityForm>) {
    setCreated(false);
    setValues((current) => ({ ...current, ...patch }));
  }

  function leaveEditing() {
    setEditing(null);
    setValues(EMPTY_CRM_ACTIVITY_FORM);
  }

  function startEditing(activity: CrmPlannedActivity) {
    setCreated(false);
    setEditing(activity);
    setValues(crmActivityToForm(activity));
  }

  async function submit() {
    if (editing) {
      if (!(await activities.update(editing, values))) return;
      leaveEditing();
      onCreated();
      return;
    }
    if (!(await activities.create(values))) return;
    setValues(EMPTY_CRM_ACTIVITY_FORM);
    setCreated(true);
    onCreated();
  }

  async function saveAndMarkDone() {
    if (!editing) return;
    const saved = await activities.update(editing, values);
    if (!saved) return;
    if (!(await activities.complete(saved))) return;
    leaveEditing();
    onCreated();
  }

  async function markDone(activity: CrmPlannedActivity) {
    if (!(await activities.complete(activity))) return;
    if (editing?.id === activity.id) leaveEditing();
    onCreated();
  }

  async function confirmDiscard() {
    if (!discarding) return;
    const item = discarding;
    setDiscarding(null);
    if (!(await activities.cancel(item))) return;
    if (editing?.id === item.id) leaveEditing();
    onCreated();
  }

  function messageFor(field: "subject" | "dueAt"): string | undefined {
    const code = activities.fieldErrors[field];
    if (!code) return undefined;
    if (code === "maxLength") {
      return formatTemplate(copy.errors.maxLength, { max: CRM_ACTIVITY_SUBJECT_MAX });
    }
    return copy.errors[code];
  }

  return (
    <>
      <FormModal
        open={target !== null}
        onOpenChange={(next) => {
          if (next) return;
          if (editing) leaveEditing();
          else onClose();
        }}
        title={copy.title}
        description={target ? formatTemplate(copy.description, { name: target.name }) : undefined}
        size="card"
        density={density}
        isDirty={isDirty}
        isSubmitting={activities.isSubmitting}
        onSubmit={() => void submit()}
        error={activities.writeError ?? undefined}
        submitDisabled={editing ? !activities.canUpdate : !activities.canCreate}
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
          sections: t.crmLeads.create.sectionsNav,
          sectionInvalid: t.crmLeads.create.sectionInvalid,
          close: t.common.close,
        }}
      >
        <div className={density === "compact" ? "grid gap-2 md:grid-cols-2" : "grid gap-4 md:grid-cols-2"}>
          <section className="flex min-w-0 flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">{copy.openHeading}</h3>
            <div className="max-h-64 min-h-0 overflow-y-auto pe-1">
              <CrmActivityList
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
                onDiscard={setDiscarding}
              />
            </div>
          </section>

          <section
            className={`flex min-w-0 flex-col gap-2 md:border-s md:border-border ${density === "compact" ? "md:ps-2" : "md:ps-4"}`}
          >
            <h3 className="text-xs font-medium text-muted-foreground">
              {editing ? copy.editHeading : copy.createHeading}
            </h3>
            {editing && (
              <p className="text-xs text-info-subtle-foreground">
                {formatTemplate(copy.editingSubject, { subject: editing.subject })}
              </p>
            )}

            {created && (
              <p role="status" className="text-xs text-success-vivid">
                {copy.created}
              </p>
            )}

            {activities.writeError && (
              <p role="alert" className="text-xs text-destructive">
                {activities.writeError}
              </p>
            )}

            <div className={density === "compact" ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
              <Field label={copy.typeLabel} required>
                <Select
                  value={values.type}
                  onValueChange={(value) => change({ type: value as CrmActivityForm["type"] })}
                  disabled={activities.isSubmitting}
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_ACTIVITY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {copy.types[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label={copy.subject} error={messageFor("subject")} required>
                <Input
                  size="sm"
                  placeholder={copy.subject}
                  value={values.subject}
                  onChange={(e) => change({ subject: e.target.value })}
                  maxLength={CRM_ACTIVITY_SUBJECT_MAX}
                  disabled={activities.isSubmitting}
                  required
                />
              </Field>

              <Field label={copy.dueAt} hint={copy.dueAtHint} error={messageFor("dueAt")} required>
                <Input
                  size="sm"
                  placeholder={copy.dueAt}
                  dir="ltr"
                  type="datetime-local"
                  value={values.dueAt}
                  onChange={(e) => change({ dueAt: e.target.value })}
                  disabled={activities.isSubmitting}
                  required
                />
              </Field>

              <Field label={copy.priority}>
                <Select
                  value={values.priority}
                  onValueChange={(value) =>
                    change({ priority: value as CrmActivityForm["priority"] })
                  }
                  disabled={activities.isSubmitting}
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_ACTIVITY_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {copy.priorities[priority]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label={copy.notes}>
                <Textarea
                  size="sm"
                  rows={2}
                  placeholder={copy.notes}
                  value={values.description}
                  onChange={(e) => change({ description: e.target.value })}
                  maxLength={CRM_ACTIVITY_DESCRIPTION_MAX}
                  disabled={activities.isSubmitting}
                />
              </Field>
            </div>
          </section>
        </div>
      </FormModal>

      <ConfirmActionModal
        open={discarding !== null}
        onOpenChange={(next) => {
          if (!next) setDiscarding(null);
        }}
        title={copy.discardTitle}
        description={copy.discardDescription}
        confirmLabel={copy.discardConfirm}
        cancelLabel={t.common.cancel}
        onConfirm={() => void confirmDiscard()}
      />
    </>
  );
}
