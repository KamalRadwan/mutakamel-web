"use client";

import { useState } from "react";
import {
  Combobox,
  DatePicker,
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
  CRM_WORK_SOURCE_TYPES,
  useCrmRecordOptions,
  type CrmWorkSourceType,
} from "@/hooks/useCrmRecordOptions";
import {
  ACTIVITY_LOCATION_MAX_LENGTH,
  ACTIVITY_SUBJECT_MAX_LENGTH,
  ACTIVITY_TEXT_MAX_LENGTH,
  combineDateAndTime,
  timeOfDay,
  type CreateCalendarEventInput,
  type CrmCalendarEvent,
  type UpdateCalendarEventInput,
} from "../../activities/activity-contract";

interface CalendarEventDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  /** null opens the create form; an event opens the edit form. */
  event: CrmCalendarEvent | null;
  isSubmitting: boolean;
  error?: string;
  onCreate: (input: CreateCalendarEventInput) => void;
  onUpdate: (input: UpdateCalendarEventInput) => void;
}

const DEFAULT_START = "09:00";
const DEFAULT_END = "10:00";

export function CalendarEventDrawer({
  open,
  onOpenChange,
  branchId,
  event,
  isSubmitting,
  error,
  onCreate,
  onUpdate,
}: CalendarEventDrawerProps) {
  const { t } = useI18n();
  const [sourceType, setSourceType] = useState<CrmWorkSourceType>("LEAD");
  const [sourceId, setSourceId] = useState<string | undefined>(undefined);
  const [sourceLabel, setSourceLabel] = useState<string | undefined>(undefined);
  // Seeded once; the caller remounts this drawer per event it opens for.
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDay, setStartDay] = useState<Date | undefined>(
    event ? new Date(event.startsAt) : undefined,
  );
  const [startTime, setStartTime] = useState(
    event ? timeOfDay(event.startsAt) : DEFAULT_START,
  );
  const [endDay, setEndDay] = useState<Date | undefined>(
    event ? new Date(event.endsAt) : undefined,
  );
  const [endTime, setEndTime] = useState(
    event ? timeOfDay(event.endsAt) : DEFAULT_END,
  );
  const records = useCrmRecordOptions(sourceType, branchId);

  const startsAt = combineDateAndTime(startDay, startTime);
  const endsAt = combineDateAndTime(endDay, endTime);
  const titleError =
    title.trim().length === 0 ? t.crmCalendar.titleRequired : undefined;
  const sourceError = event || sourceId ? undefined : t.crmCalendar.sourceRequired;
  const windowError =
    startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()
      ? t.crmCalendar.windowInvalid
      : !startsAt || !endsAt
        ? t.crmCalendar.windowRequired
        : undefined;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={event ? t.crmCalendar.editTitle : t.crmCalendar.createTitle}
      description={
        event ? t.crmCalendar.editDescription : t.crmCalendar.createDescription
      }
      isDirty={title.length > 0 || sourceId !== undefined}
      isSubmitting={isSubmitting}
      submitDisabled={Boolean(titleError || sourceError || windowError)}
      error={error}
      onSubmit={() => {
        if (titleError || windowError || !startsAt || !endsAt) return;
        if (event) {
          onUpdate({ title, startsAt, endsAt });
          return;
        }
        if (!sourceId) return;
        onCreate({
          branchId,
          title,
          sourceType,
          sourceId,
          description,
          location,
          startsAt,
          endsAt,
        });
      }}
      labels={{
        submit: event ? t.common.save : t.common.create,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      {!event && records.error ? (
        <DegradedBanner message={t.crmCalendar.recordsUnavailable} />
      ) : null}

      <Field label={t.crmCalendar.title} error={titleError} required>
        <Input
          value={title}
          maxLength={ACTIVITY_SUBJECT_MAX_LENGTH}
          onChange={(input) => setTitle(input.target.value)}
        />
      </Field>

      {event ? null : (
        <>
          <Field label={t.crmCalendar.sourceType}>
            <Select
              value={sourceType}
              onValueChange={(next) => {
                setSourceType(next as CrmWorkSourceType);
                setSourceId(undefined);
                setSourceLabel(undefined);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRM_WORK_SOURCE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t.crmTasks.sourceTypeValues[type] ?? type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t.crmCalendar.sourceRecord} error={sourceError} required>
            <Combobox
              value={sourceId}
              selectedLabel={sourceLabel}
              onValueChange={(next) => {
                setSourceId(next);
                setSourceLabel(
                  records.options.find((option) => option.value === next)?.label,
                );
              }}
              options={records.options}
              onSearch={records.search}
              loading={records.isLoading}
              placeholder={t.crmCalendar.sourceRecordPlaceholder}
              searchPlaceholder={t.common.search}
              loadingLabel={t.common.loading}
              emptyLabel={t.crmTasks.recordsEmpty}
              clearLabel={t.common.dismiss}
            />
          </Field>
        </>
      )}

      {/* A day and a time, combined into one instant: the route takes a
          @IsDate() moment and refuses endsAt <= startsAt, so a date-only
          picker could never produce a valid event. */}
      <Field label={t.crmCalendar.startsAt} error={windowError} required>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-40 flex-1">
            <DatePicker
              value={startDay}
              onValueChange={setStartDay}
              placeholder={t.crmCalendar.dayPlaceholder}
            />
          </div>
          <Input
            type="time"
            className="w-32"
            value={startTime}
            aria-label={t.crmCalendar.startTime}
            onChange={(input) => setStartTime(input.target.value)}
          />
        </div>
      </Field>

      <Field label={t.crmCalendar.endsAt} required>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-40 flex-1">
            <DatePicker
              value={endDay}
              onValueChange={setEndDay}
              placeholder={t.crmCalendar.dayPlaceholder}
            />
          </div>
          <Input
            type="time"
            className="w-32"
            value={endTime}
            aria-label={t.crmCalendar.endTime}
            onChange={(input) => setEndTime(input.target.value)}
          />
        </div>
      </Field>

      {event ? (
        <p className="text-xs text-muted-foreground">
          {t.crmCalendar.projectionNote}
        </p>
      ) : (
        <>
          <Field label={t.crmCalendar.location}>
            <Input
              value={location}
              maxLength={ACTIVITY_LOCATION_MAX_LENGTH}
              onChange={(input) => setLocation(input.target.value)}
            />
          </Field>
          <Field label={t.crmCalendar.description}>
            <Textarea
              value={description}
              maxLength={ACTIVITY_TEXT_MAX_LENGTH}
              onChange={(input) => setDescription(input.target.value)}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            {t.crmCalendar.attendeesNote}
          </p>
        </>
      )}
    </FormDrawer>
  );
}
