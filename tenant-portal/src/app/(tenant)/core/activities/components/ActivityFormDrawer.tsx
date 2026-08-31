"use client";

import { useState } from "react";
import {
  Combobox,
  DegradedBanner,
  Field,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  ACTIVITY_DESCRIPTION_MAX,
  ACTIVITY_DIRECTIONS,
  ACTIVITY_PRIORITIES,
  ACTIVITY_SUBJECT_MAX,
  ACTIVITY_TARGET_APPS,
  ACTIVITY_TARGET_TYPES,
  ACTIVITY_TYPE_KEYS,
  type Activity,
  type ActivityTargetApp,
} from "../activities-contract";
import {
  EMPTY_ACTIVITY_FORM,
  toActivityForm,
  type ActivityFormValues,
} from "../activity-forms";
import { useActivityFormOptions } from "../hooks/useActivityFormOptions";

interface ActivityFormDrawerProps {
  activity: Activity | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ActivityFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function ActivityFormDrawer({
  activity,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: ActivityFormDrawerProps) {
  const { t } = useI18n();
  const copy = t.coreOperations.activities;
  const initial = activity ? toActivityForm(activity) : EMPTY_ACTIVITY_FORM;
  const [values, setValues] = useState<ActivityFormValues>(initial);
  const options = useActivityFormOptions({
    targetApp: values.targetApp,
    targetType: values.targetType,
    targetId: values.targetId,
  });
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);
  const change = (patch: Partial<ActivityFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));
  const typeKeys = options.types.length > 0 ? options.types.map((type) => type.key) : [...ACTIVITY_TYPE_KEYS];
  const selectedAssignee = options.assignees.find(
    (assignee) => assignee.id === values.assigneeUserId,
  );

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={activity ? copy.editTitle : copy.createTitle}
      description={activity ? copy.editDescription : copy.createDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-4">
        {options.typesUnavailable ? <DegradedBanner message={copy.typesUnavailable} /> : null}
        {options.assigneesUnavailable ? (
          <DegradedBanner message={copy.assigneesUnavailable} />
        ) : null}

        {activity ? null : (
          <>
            <Field label={copy.targetApp} hint={copy.targetHint} required>
              <Select
                value={values.targetApp}
                onValueChange={(value) => {
                  const app = value as ActivityTargetApp;
                  change({
                    targetApp: app,
                    targetType: ACTIVITY_TARGET_TYPES[app][0] ?? "",
                    targetId: "",
                    assigneeUserId: "",
                  });
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TARGET_APPS.map((app) => (
                    <SelectItem key={app} value={app}>
                      {copy.targetApps[app]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={copy.targetType} required>
              <Select
                value={values.targetType}
                onValueChange={(value) => change({ targetType: value, assigneeUserId: "" })}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TARGET_TYPES[values.targetApp].map((type) => (
                    <SelectItem key={type} value={type}>
                      {copy.targetTypes[type] ?? type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={copy.targetId} hint={copy.targetIdHint} required>
              <Input
                dir="ltr"
                value={values.targetId}
                onChange={(event) => change({ targetId: event.target.value.trim() })}
                disabled={isSubmitting}
                required
              />
            </Field>
          </>
        )}

        <Field label={copy.typeLabel} required>
          <Select
            value={values.type}
            onValueChange={(value) => change({ type: value })}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeKeys.map((key) => (
                <SelectItem key={key} value={key}>
                  {copy.types[key] ?? key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={copy.subject} required>
          <Input
            value={values.subject}
            onChange={(event) => change({ subject: event.target.value })}
            maxLength={ACTIVITY_SUBJECT_MAX}
            disabled={isSubmitting}
            required
          />
        </Field>

        <Field label={copy.description}>
          <Textarea
            value={values.description}
            onChange={(event) => change({ description: event.target.value })}
            maxLength={ACTIVITY_DESCRIPTION_MAX}
            disabled={isSubmitting}
          />
        </Field>

        <Field label={copy.priority}>
          <Select
            value={values.priority}
            onValueChange={(value) =>
              change({ priority: value as ActivityFormValues["priority"] })
            }
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_PRIORITIES.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {copy.priorities[priority]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={copy.direction} hint={copy.directionHint}>
          <Select
            value={values.direction || "NONE"}
            onValueChange={(value) =>
              change({
                direction: value === "NONE" ? "" : (value as ActivityFormValues["direction"]),
              })
            }
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">{copy.directionNone}</SelectItem>
              {ACTIVITY_DIRECTIONS.map((direction) => (
                <SelectItem key={direction} value={direction}>
                  {copy.directions[direction]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={copy.dueAt} hint={copy.dueAtHint} required>
          <Input
            dir="ltr"
            type="datetime-local"
            value={values.dueAt}
            onChange={(event) => change({ dueAt: event.target.value })}
            disabled={isSubmitting}
            required
          />
        </Field>

        <Field
          label={copy.assignee}
          hint={options.isTargetResolved ? copy.assigneeHint : copy.assigneeNeedsTarget}
          required={!activity}
        >
          <Combobox
            value={values.assigneeUserId || undefined}
            selectedLabel={selectedAssignee?.name}
            onValueChange={(next) => change({ assigneeUserId: next ?? "" })}
            options={options.assignees.map((assignee) => ({
              value: assignee.id,
              label: assignee.name,
            }))}
            onSearch={options.searchAssignees}
            loading={options.isLoadingAssignees}
            placeholder={copy.assigneePlaceholder}
            searchPlaceholder={copy.assigneeSearch}
            loadingLabel={t.common.loading}
            emptyLabel={copy.assigneeEmpty}
            disabled={isSubmitting || !options.isTargetResolved || !options.canAssign}
          />
        </Field>
      </div>
    </FormDrawer>
  );
}
