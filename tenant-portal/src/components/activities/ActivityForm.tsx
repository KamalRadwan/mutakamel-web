"use client";

import {
  Combobox,
  Field,
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
  ACTIVITY_LOCATION_MAX,
  ACTIVITY_MEETING_URL_MAX,
  ACTIVITY_OUTCOME_MAX,
  ACTIVITY_PRIORITIES,
  ACTIVITY_SUBJECT_MAX,
  type Activity,
  type ActivityCreateStatus,
  type ActivityScope,
} from "./activity-contract";
import { activityValidationMessage, type ActivityFormField } from "./activity-form-rules";
import { activityLabel, activityTypeTraits } from "./activity-presentation";
import { ActivityScheduleFields } from "./ActivityScheduleFields";
import { ActivityTargetField } from "./ActivityTargetField";
import { ActivityTypePicker } from "./ActivityTypePicker";
import { useActivityAssigneeOptions } from "./hooks/useActivityAssigneeOptions";
import type { ActivityFormState } from "./hooks/useActivityFormState";

// Radix Select reserves the empty string, so "no direction" needs a value of its own.
const NO_DIRECTION = "NONE";

export interface ActivityFormProps {
  form: ActivityFormState;
  mode: "create" | "edit";
  scope: ActivityScope;
  branchId?: string | null;
  /** Opened from a record, or editing: the record is named in the header, not picked here. */
  targetFixed: boolean;
  /** Create: the statuses the actor may file in. The control shows only when there is a choice. */
  statuses: readonly ActivityCreateStatus[];
  canAssign: boolean;
  actorId: string | null;
  /** Edit: the activity, for its current assignee. */
  activity: Activity | null;
  disabled: boolean;
}

/**
 * The activity's fields. The type decides which of them exist — a task has no
 * end, a meeting has a place and a link — so switching type reshapes the form
 * without losing what was typed into a field that is only hidden.
 */
export function ActivityForm(props: ActivityFormProps) {
  const { form, mode, disabled } = props;
  const { t } = useI18n();
  const copy = t.activities;
  const { values, errors } = form;
  const traits = activityTypeTraits(values.type);
  const message = (field: ActivityFormField) => activityValidationMessage(copy, field, errors[field]);

  return (
    <div className="flex flex-col gap-3">
      <ActivityTypePicker value={values.type} onChange={form.setType} disabled={disabled} />

      <Field label={copy.form.subject} error={message("subject")} required>
        <Input
          value={values.subject}
          onChange={(event) => form.setField("subject", event.target.value)}
          onBlur={() => form.touch("subject")}
          placeholder={copy.form.subjectPlaceholder}
          maxLength={ACTIVITY_SUBJECT_MAX}
          disabled={disabled}
        />
      </Field>

      {mode === "create" && !props.targetFixed && (
        <ActivityTargetField
          scope={props.scope}
          branchId={props.branchId}
          value={values.target}
          onChange={form.setTarget}
          onBlur={() => form.touch("target")}
          error={message("target")}
          disabled={disabled}
        />
      )}

      <ActivityScheduleFields form={form} disabled={disabled} />

      <div className="grid gap-3 sm:grid-cols-3">
        {mode === "create" && props.statuses.length > 1 && (
          <Captioned caption={copy.form.status}>
            <Field label={copy.form.status}>
              <Select value={values.status} onValueChange={(status) => form.setStatus(status as ActivityCreateStatus)} disabled={disabled}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {props.statuses.map((status) => (
                    <SelectItem key={status} value={status}>{copy.statuses[status]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Captioned>
        )}
        <Captioned caption={copy.form.priority}>
          <Field label={copy.form.priority}>
            <Select value={values.priority} onValueChange={(priority) => form.setField("priority", priority)} disabled={disabled}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>{copy.priorities[priority]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Captioned>
        {traits.hasDirection && (
          <Captioned caption={copy.form.direction}>
            <Field label={copy.form.direction}>
              <Select
                value={values.direction || NO_DIRECTION}
                onValueChange={(direction) => form.setField("direction", direction === NO_DIRECTION ? "" : direction)}
                disabled={disabled}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DIRECTION}>{copy.form.directionNone}</SelectItem>
                  {ACTIVITY_DIRECTIONS.map((direction) => (
                    <SelectItem key={direction} value={direction}>{activityLabel(copy, "directions", direction)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Captioned>
        )}
      </div>

      <ActivityAssigneeField {...props} />

      {(traits.hasLocation || traits.hasMeetingUrl) && (
        <fieldset className="flex min-w-0 flex-col gap-1">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">{copy.form.meetingDetails}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {traits.hasLocation && (
              <Field label={copy.form.location} error={message("location")}>
                <Input
                  value={values.location}
                  onChange={(event) => form.setField("location", event.target.value)}
                  onBlur={() => form.touch("location")}
                  placeholder={copy.form.locationPlaceholder}
                  maxLength={ACTIVITY_LOCATION_MAX}
                  disabled={disabled}
                />
              </Field>
            )}
            {traits.hasMeetingUrl && (
              <Field label={copy.form.meetingUrl} error={message("meetingUrl")}>
                <Input
                  type="url"
                  dir="ltr"
                  value={values.meetingUrl}
                  onChange={(event) => form.setField("meetingUrl", event.target.value)}
                  onBlur={() => form.touch("meetingUrl")}
                  placeholder={copy.form.meetingUrlPlaceholder}
                  maxLength={ACTIVITY_MEETING_URL_MAX}
                  disabled={disabled}
                />
              </Field>
            )}
          </div>
        </fieldset>
      )}

      <Field label={copy.form.description} error={message("description")}>
        <Textarea
          value={values.description}
          onChange={(event) => form.setField("description", event.target.value)}
          onBlur={() => form.touch("description")}
          placeholder={copy.form.descriptionPlaceholder}
          maxLength={ACTIVITY_DESCRIPTION_MAX}
          disabled={disabled}
        />
      </Field>

      {mode === "create" && values.status === "DONE" && (
        <Field label={copy.form.outcome} error={message("outcome")}>
          <Textarea
            value={values.outcome}
            onChange={(event) => form.setField("outcome", event.target.value)}
            onBlur={() => form.touch("outcome")}
            placeholder={copy.form.outcomePlaceholder}
            maxLength={ACTIVITY_OUTCOME_MAX}
            rows={2}
            disabled={disabled}
          />
        </Field>
      )}
    </div>
  );
}

// A visible name above a control whose value would otherwise stand alone
// ("Normal", "Scheduled"). `Field` already names the control for assistive
// technology, so the caption is hidden from it rather than read twice.
function Captioned({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">{caption}</span>
      {children}
    </div>
  );
}

/**
 * Who holds the activity. Eligible people depend on the record, so the picker
 * exists only once a record is chosen and only for an actor who may assign;
 * otherwise the default reads back, unchangeable: "Me" on a create, the
 * current assignee on an edit.
 */
function ActivityAssigneeField({ form, canAssign, actorId, activity, disabled }: ActivityFormProps) {
  const { t } = useI18n();
  const copy = t.activities.form;
  const target = form.values.target;
  const pickable = canAssign && target !== null;
  const options = useActivityAssigneeOptions(pickable ? target : null);
  const currentId = form.values.assigneeUserId ?? activity?.assigneeUserId ?? actorId;
  const defaultLabel = activity ? activity.assigneeName : null;
  const currentLabel = form.values.assigneeLabel
    ?? (currentId === actorId ? copy.assigneeMe : defaultLabel)
    ?? currentId
    ?? copy.assigneeMe;

  return (
    <Captioned caption={copy.assignee}>
      <Field label={copy.assignee} hint={canAssign && !target ? copy.assigneeNeedsTarget : undefined} readOnly={!pickable}>
        {pickable ? (
          <Combobox
            value={currentId ?? undefined}
            selectedLabel={currentLabel}
            onValueChange={(id) => {
              const option = options.options.find((candidate) => candidate.id === id);
              form.setAssignee(option?.id ?? null, option?.name ?? null);
            }}
            options={options.options.map((option) => ({ value: option.id, label: option.name }))}
            onSearch={options.search}
            loading={options.isLoading}
            placeholder={copy.assigneePlaceholder}
            searchPlaceholder={copy.assigneeSearch}
            loadingLabel={copy.relatedLoading}
            emptyLabel={options.failed ? copy.assigneeUnavailable : copy.assigneeEmpty}
            disabled={disabled}
          />
        ) : (
          // `dir="auto"`: the fallback is a raw id when Core has no name, and a
          // Latin identifier must not be reordered by the Arabic paragraph.
          <Input value={currentLabel} readOnly dir="auto" />
        )}
      </Field>
    </Captioned>
  );
}
