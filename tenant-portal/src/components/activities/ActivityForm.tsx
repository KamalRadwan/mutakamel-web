"use client";

import { Check, CheckCircle2, Globe, MapPin, UserCheck, Video } from "lucide-react";
import {
  Button,
  cn,
  Combobox,
  Field,
  iconSize,
  Input,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  ACTIVITY_DESCRIPTION_MAX,
  ACTIVITY_DIRECTIONS,
  ACTIVITY_LOCATION_MAX,
  ACTIVITY_MEETING_URL_MAX,
  ACTIVITY_OUTCOME_MAX,
  ACTIVITY_PRIORITIES,
  ACTIVITY_SUBJECT_MAX,
  activityTextLength,
  type Activity,
  type ActivityCreateStatus,
  type ActivityScope,
} from "./activity-contract";
import { isActivityFieldModified } from "./activity-form";
import { activityValidationMessage, isHttpUrl, type ActivityFormField } from "./activity-form-rules";
import {
  activityLabel,
  activityPriorityDotClasses,
  activityPriorityPillClasses,
  activityStatusDotClasses,
  activityStatusPillClasses,
  activityTypePalette,
  activityTypeTraits,
} from "./activity-presentation";
import { ActivityScheduleFields } from "./ActivityScheduleFields";
import { ActivityReminderField } from "./ActivityReminderField";
import { ActivityTargetField } from "./ActivityTargetField";
import { ActivityTypePicker } from "./ActivityTypePicker";
import { useActivityAssigneeOptions } from "./hooks/useActivityAssigneeOptions";
import type { ActivityFormState } from "./hooks/useActivityFormState";

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
  actorName?: string | null;
  /** Edit: the activity, for its current assignee. */
  activity: Activity | null;
  disabled: boolean;
}

function getInitials(name: string): string {
  const cleaned = name.replace(/\(.*?\)/gu, "").trim();
  const parts = cleaned.split(/\s+/u).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
  }
  return (cleaned.slice(0, 2) || "ME").toUpperCase();
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
  const { values, seed, errors } = form;
  const traits = activityTypeTraits(values.type);
  const palette = activityTypePalette(values.type);
  const message = (field: ActivityFormField) => activityValidationMessage(copy, field, errors[field]);
  const isEdit = mode === "edit";

  const subjectLength = activityTextLength(values.subject);
  const locationLength = activityTextLength(values.location);
  const descriptionLength = activityTextLength(values.description);
  const outcomeLength = activityTextLength(values.outcome);
  const meetingUrlValid = values.meetingUrl.trim().length > 0 && isHttpUrl(values.meetingUrl.trim());

  const subjectBlock = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="text-xs font-semibold text-foreground">
            {copy.form.subject} <span className="text-destructive">*</span>
          </span>
          {isEdit && isActivityFieldModified(values, seed, "subject") && (
            <ModifiedBadge label={copy.form.modified} />
          )}
        </div>
        <span className="text-2xs font-medium tabular-nums text-muted-foreground">
          {formatTemplate(copy.form.charCount, { count: subjectLength, max: ACTIVITY_SUBJECT_MAX })}
        </span>
      </div>
      <Field label={copy.form.subject} error={message("subject")} required>
        <Input
          size="sm"
          value={values.subject}
          onChange={(event) => form.setField("subject", event.target.value)}
          onBlur={() => form.touch("subject")}
          placeholder={copy.form.subjectPlaceholder}
          maxLength={ACTIVITY_SUBJECT_MAX}
          disabled={disabled}
        />
      </Field>
    </div>
  );

  const statusBlock =
    mode === "create" && props.statuses.length > 1 ? (
      <div className="flex min-w-0 flex-col gap-1.5">
        <span aria-hidden="true" className="text-xs font-semibold text-foreground">
          {traits.hasDirection ? copy.form.initialStatus : copy.form.status}
        </span>
        <ToggleGroup
          type="single"
          value={values.status}
          onValueChange={(next) => {
            if (next) form.setStatus(next as ActivityCreateStatus);
          }}
          disabled={disabled}
          aria-label={copy.form.status}
          className="grid w-full grid-cols-3 gap-1 rounded-lg border border-border bg-muted/50 p-1"
        >
          {props.statuses.map((status) => {
            const selected = values.status === status;
            return (
              <ToggleGroupItem
                key={status}
                value={status}
                className={cn(
                  "h-7 min-w-0 gap-1.5 rounded-md border px-2 text-xs font-semibold transition-all",
                  "data-[state=on]:bg-transparent data-[state=on]:text-current",
                  activityStatusPillClasses(status, selected),
                )}
              >
                <span className={cn("size-1.5 shrink-0 rounded-full", activityStatusDotClasses(status))} aria-hidden="true" />
                <span className="truncate">{copy.statuses[status]}</span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>
    ) : null;

  const priorityBlock = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span aria-hidden="true" className="text-xs font-semibold text-foreground">
          {copy.form.priority}
        </span>
        {isEdit && isActivityFieldModified(values, seed, "priority") && (
          <ModifiedBadge label={copy.form.modified} />
        )}
      </div>
      <ToggleGroup
        type="single"
        value={values.priority}
        onValueChange={(next) => {
          if (next) form.setField("priority", next);
        }}
        disabled={disabled}
        aria-label={copy.form.priority}
        className="grid w-full grid-cols-4 gap-1 rounded-lg border border-border bg-muted/50 p-1"
      >
        {ACTIVITY_PRIORITIES.map((priority) => {
          const selected = values.priority === priority;
          return (
            <ToggleGroupItem
              key={priority}
              value={priority}
              className={cn(
                "h-7 min-w-0 gap-1 rounded-md border px-1.5 text-xs font-semibold transition-all",
                "data-[state=on]:bg-transparent data-[state=on]:text-current",
                activityPriorityPillClasses(priority, selected),
              )}
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", activityPriorityDotClasses(priority))} aria-hidden="true" />
              <span className="truncate">{copy.priorities[priority]}</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );

  const directionBlock = traits.hasDirection ? (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span aria-hidden="true" className="text-xs font-semibold text-foreground">
          {values.type === "CALL" ? copy.form.callDirection : copy.form.direction}
        </span>
        {isEdit && isActivityFieldModified(values, seed, "direction") && (
          <ModifiedBadge label={copy.form.modified} />
        )}
      </div>
      <ToggleGroup
        type="single"
        value={values.direction || NO_DIRECTION}
        onValueChange={(next) => {
          if (next) form.setField("direction", next === NO_DIRECTION ? "" : next);
        }}
        disabled={disabled}
        aria-label={copy.form.direction}
        className="grid w-full grid-cols-4 gap-1 rounded-lg border border-border bg-muted/50 p-1"
      >
        <ToggleGroupItem
          value={NO_DIRECTION}
          className={cn(
            "h-7 min-w-0 rounded-md border px-1.5 text-xs font-medium transition-all",
            "data-[state=on]:bg-transparent data-[state=on]:text-current",
            !values.direction
              ? "border-border bg-card font-semibold text-foreground shadow-2xs"
              : "border-transparent bg-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground",
          )}
        >
          <span className="truncate">{copy.form.directionNone}</span>
        </ToggleGroupItem>
        {ACTIVITY_DIRECTIONS.map((direction) => {
          const selected = values.direction === direction;
          return (
            <ToggleGroupItem
              key={direction}
              value={direction}
              className={cn(
                "h-7 min-w-0 rounded-md border px-1.5 text-xs font-medium transition-all",
                "data-[state=on]:bg-transparent data-[state=on]:text-current",
                selected
                  ? cn("font-semibold", palette.pillActive)
                  : "border-transparent bg-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              <span className="truncate">{activityLabel(copy, "directions", direction)}</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  ) : null;

  const directionInSubcard = traits.hasDirection && (traits.hasLocation || traits.hasMeetingUrl);
  const directionInSchedule = traits.hasDirection && !directionInSubcard;

  const notesBlock = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="text-xs font-semibold text-foreground">
            {copy.form.description}
          </span>
          {isEdit && isActivityFieldModified(values, seed, "description") && (
            <ModifiedBadge label={copy.form.modified} />
          )}
        </div>
        <span className="text-2xs font-medium tabular-nums text-muted-foreground">
          {formatTemplate(copy.form.charCount, { count: descriptionLength, max: ACTIVITY_DESCRIPTION_MAX })}
        </span>
      </div>
      <Field label={copy.form.description} error={message("description")}>
        <Textarea
          size="sm"
          value={values.description}
          onChange={(event) => form.setField("description", event.target.value)}
          onBlur={() => form.touch("description")}
          placeholder={copy.form.descriptionPlaceholder}
          maxLength={ACTIVITY_DESCRIPTION_MAX}
          rows={2}
          disabled={disabled}
        />
      </Field>
    </div>
  );

  const outcomeBlock =
    mode === "create" && values.status === "DONE" ? (
      <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-success/35 bg-success-subtle/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className={cn(iconSize({ size: "sm" }), "text-success-subtle-foreground")} aria-hidden="true" />
            <span aria-hidden="true" className="text-xs font-semibold text-success-subtle-foreground">
              {copy.form.completionOutcomeTitle}
            </span>
          </div>
          <span className="text-2xs font-medium tabular-nums text-success-subtle-foreground/80">
            {formatTemplate(copy.form.charCount, { count: outcomeLength, max: ACTIVITY_OUTCOME_MAX })}
          </span>
        </div>
        <Field label={copy.form.outcome} error={message("outcome")}>
          <Textarea
            size="sm"
            className="bg-card"
            value={values.outcome}
            onChange={(event) => form.setField("outcome", event.target.value)}
            onBlur={() => form.touch("outcome")}
            placeholder={copy.form.outcomePlaceholder}
            maxLength={ACTIVITY_OUTCOME_MAX}
            rows={2}
            disabled={disabled}
          />
        </Field>
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Section Header in Create Mode (Task / non-windowed types) */}
      {mode === "create" && props.targetFixed && !traits.hasEnd && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", palette.dot)} aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {copy.form.sectionScheduleNew}
            </span>
          </div>
          <span className="text-2xs text-muted-foreground">{copy.form.requiredFieldsNote}</span>
        </div>
      )}

      {/* Standalone Target Record Picker (when creating without fixed record) */}
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

      {/* 1. Colorful Activity Type Picker */}
      <ActivityTypePicker
        value={values.type}
        onChange={form.setType}
        disabled={disabled}
        modified={isEdit && isActivityFieldModified(values, seed, "type")}
        mode={mode}
      />

      {/* 2. Title + Contextual Side Partner (Locked Target on Edit, Assignee on Windowed/Directed Create, or Full-Width Title on Task Create) */}
      {isEdit && values.target ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {subjectBlock}
          <ActivityTargetField
            scope={props.scope}
            branchId={props.branchId}
            value={values.target}
            onChange={form.setTarget}
            onBlur={() => form.touch("target")}
            disabled={true}
            locked={true}
          />
        </div>
      ) : mode === "create" && (traits.hasEnd || directionInSchedule) ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {subjectBlock}
          <ActivityAssigneeField {...props} />
        </div>
      ) : (
        subjectBlock
      )}

      {/* 3. Schedule / Time Window Card */}
      {(mode === "edit" || values.status !== "DONE") && <ActivityReminderField form={form} disabled={disabled} />}
      <ActivityScheduleFields
        form={form}
        disabled={disabled}
        mode={mode}
        assigneeSlot={
          directionInSchedule
            ? directionBlock
            : !isEdit && !traits.hasEnd
              ? <ActivityAssigneeField {...props} />
              : undefined
        }
      />

      {/* 4. Contextual Meeting / Call / Visit Details Subcard */}
      {(traits.hasLocation || traits.hasMeetingUrl) && (
        <div className={cn("flex min-w-0 flex-col gap-2.5 rounded-lg border p-3", palette.sectionCard)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Video className={cn(iconSize({ size: "sm" }), palette.iconText)} aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">
                {values.type === "CALL" ? copy.form.callDetails : copy.form.meetingDetails}
              </span>
            </div>
            {meetingUrlValid && (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/35 bg-success-subtle px-2 py-0.5 text-2xs font-semibold text-success-subtle-foreground">
                <Check className={iconSize({ size: "xs" })} aria-hidden="true" />
                {copy.form.validUrl}
              </span>
            )}
          </div>
          <div
            className={cn(
              "grid gap-3",
              (traits.hasLocation && traits.hasMeetingUrl) || (directionInSubcard && !traits.hasLocation)
                ? "sm:grid-cols-2"
                : undefined,
            )}
          >
            {directionInSubcard && !traits.hasLocation && directionBlock}
            {traits.hasLocation && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <MapPin className={cn(iconSize({ size: "xs" }), "text-muted-foreground")} aria-hidden="true" />
                    <span aria-hidden="true" className="text-xs font-semibold text-foreground">
                      {copy.form.location}
                    </span>
                    {isEdit && isActivityFieldModified(values, seed, "location") && (
                      <ModifiedBadge label={copy.form.modified} />
                    )}
                  </div>
                  <span className="text-2xs font-medium tabular-nums text-muted-foreground">
                    {formatTemplate(copy.form.charCount, { count: locationLength, max: ACTIVITY_LOCATION_MAX })}
                  </span>
                </div>
                <Field label={copy.form.location} error={message("location")}>
                  <Input
                    size="sm"
                    className="bg-card"
                    value={values.location}
                    onChange={(event) => form.setField("location", event.target.value)}
                    onBlur={() => form.touch("location")}
                    placeholder={copy.form.locationPlaceholder}
                    maxLength={ACTIVITY_LOCATION_MAX}
                    disabled={disabled}
                  />
                </Field>
              </div>
            )}
            {traits.hasMeetingUrl && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Globe className={cn(iconSize({ size: "xs" }), "text-muted-foreground")} aria-hidden="true" />
                    <span aria-hidden="true" className="text-xs font-semibold text-foreground">
                      {copy.form.meetingUrl}
                    </span>
                    {isEdit && isActivityFieldModified(values, seed, "meetingUrl") && (
                      <ModifiedBadge label={copy.form.modified} />
                    )}
                  </div>
                </div>
                <Field label={copy.form.meetingUrl} error={message("meetingUrl")}>
                  <Input
                    size="sm"
                    type="url"
                    dir="ltr"
                    className="bg-card"
                    value={values.meetingUrl}
                    onChange={(event) => form.setField("meetingUrl", event.target.value)}
                    onBlur={() => form.touch("meetingUrl")}
                    placeholder={copy.form.meetingUrlPlaceholder}
                    maxLength={ACTIVITY_MEETING_URL_MAX}
                    disabled={disabled}
                  />
                </Field>
              </div>
            )}
          </div>
          {directionInSubcard && traits.hasLocation && directionBlock}
        </div>
      )}

      {/* 5. Segmented Pills Row (Always 2 columns max so pills never truncate) */}
      {isEdit ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ActivityAssigneeField {...props} />
          {priorityBlock}
        </div>
      ) : (
        <div className={cn("grid gap-3", statusBlock ? "sm:grid-cols-2" : undefined)}>
          {statusBlock}
          {priorityBlock}
        </div>
      )}

      {/* 6. Notes & Completion Outcome */}
      {outcomeBlock ? (
        <div className="grid gap-3 md:grid-cols-2">
          {notesBlock}
          {outcomeBlock}
        </div>
      ) : (
        notesBlock
      )}
    </div>
  );
}

function ModifiedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning-subtle px-1.5 py-0.5 text-2xs font-semibold text-warning-subtle-foreground">
      {label}
    </span>
  );
}

/**
 * Who holds the activity. Eligible people depend on the record, so the picker
 * exists only once a record is chosen and only for an actor who may assign;
 * otherwise the default reads back, unchangeable: "Me" on a create, the
 * current assignee on an edit.
 */
function ActivityAssigneeField({ form, mode, canAssign, actorId, actorName, activity, disabled }: ActivityFormProps) {
  const { t } = useI18n();
  const copy = t.activities.form;
  const target = form.values.target;
  const pickable = canAssign && target !== null;
  const options = useActivityAssigneeOptions(pickable ? target : null);
  const currentId = form.values.assigneeUserId ?? activity?.assigneeUserId ?? actorId;
  const defaultLabel = activity ? activity.assigneeName : null;
  const meDisplay = actorName ? `${actorName} (${copy.assigneeMe})` : copy.assigneeMe;
  const currentLabel =
    form.values.assigneeLabel ??
    (currentId === actorId ? meDisplay : defaultLabel) ??
    currentId ??
    meDisplay;
  const initials = getInitials(currentLabel);
  const modified = mode === "edit" && isActivityFieldModified(form.values, form.seed, "assigneeUserId");

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="text-xs font-semibold text-foreground">
            {copy.assignee}
          </span>
          {modified && <ModifiedBadge label={copy.modified} />}
        </div>
        {pickable && actorId && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            onClick={() => form.setAssignee(actorId, meDisplay)}
            className="h-5 gap-1 px-1.5 text-2xs font-semibold text-primary hover:bg-selected"
          >
            <UserCheck className={iconSize({ size: "xs" })} aria-hidden="true" />
            {copy.assignToMe}
          </Button>
        )}
      </div>
      <Field label={copy.assignee} hint={canAssign && !target ? copy.assigneeNeedsTarget : undefined} readOnly={!pickable}>
        {pickable ? (
          <Combobox
            size="sm"
            value={currentId ?? undefined}
            selectedLabel={currentLabel}
            leadingSlot={
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-swatch-indigo text-2xs font-semibold text-primary-foreground">
                {initials}
              </span>
            }
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
          <Input size="sm" className="bg-card" value={currentLabel} readOnly dir="auto" />
        )}
      </Field>
    </div>
  );
}
