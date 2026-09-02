"use client";

import { useState } from "react";
import {
  Combobox,
  DatePicker,
  DegradedBanner,
  Field,
  FieldControlBoundary,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useCrmRecordOptions } from "@/hooks/useCrmRecordOptions";
import {
  CRM_REMINDER_CHANNELS,
  CRM_REMINDER_TARGET_TYPES,
  combineDateAndTime,
  type CreateReminderInput,
  type CrmReminderChannel,
  type CrmReminderTargetType,
} from "../../activities/activity-contract";

interface CreateReminderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  isSubmitting: boolean;
  error?: string;
  onSubmit: (input: CreateReminderInput) => void;
}

const DEFAULT_TIME = "09:00";

export function CreateReminderDrawer({
  open,
  onOpenChange,
  branchId,
  isSubmitting,
  error,
  onSubmit,
}: CreateReminderDrawerProps) {
  const { t } = useI18n();
  const [targetType, setTargetType] = useState<CrmReminderTargetType>("TASK");
  const [targetId, setTargetId] = useState<string | undefined>(undefined);
  const [targetLabel, setTargetLabel] = useState<string | undefined>(undefined);
  const [channel, setChannel] = useState<CrmReminderChannel>("IN_APP");
  const [day, setDay] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState(DEFAULT_TIME);
  // The service refuses `remindAt <= Date.now()` with 422
  // CRM_REMINDER_TIME_INVALID. The clock is read on submit rather than during
  // render — a render must stay pure, and the answer would go stale anyway.
  const [pastError, setPastError] = useState<string | undefined>(undefined);
  const targets = useCrmRecordOptions(targetType, branchId);

  const remindAt = combineDateAndTime(day, time);
  const targetError = targetId ? undefined : t.crmReminders.targetRequired;
  const timeError = remindAt ? pastError : t.crmReminders.timeRequired;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t.crmReminders.createTitle}
      description={t.crmReminders.createDescription}
      isDirty={targetId !== undefined || day !== undefined}
      isSubmitting={isSubmitting}
      submitDisabled={Boolean(targetError || timeError)}
      error={error}
      onSubmit={() => {
        if (!targetId || !remindAt) return;
        if (remindAt.getTime() <= Date.now()) {
          setPastError(t.crmReminders.timeInPast);
          return;
        }
        setPastError(undefined);
        onSubmit({ branchId, targetType, targetId, channel, remindAt });
      }}
      labels={{
        submit: t.common.create,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      {targets.error ? (
        <DegradedBanner message={t.crmReminders.targetsUnavailable} />
      ) : null}

      <Field label={t.crmReminders.targetType}>
        <Select
          value={targetType}
          onValueChange={(next) => {
            setTargetType(next as CrmReminderTargetType);
            setTargetId(undefined);
            setTargetLabel(undefined);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRM_REMINDER_TARGET_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t.crmReminders.targetTypeValues[type] ?? type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.crmReminders.target} error={targetError} required>
        <Combobox
          value={targetId}
          selectedLabel={targetLabel}
          onValueChange={(next) => {
            setTargetId(next);
            setTargetLabel(
              targets.options.find((option) => option.value === next)?.label,
            );
          }}
          options={targets.options}
          onSearch={targets.search}
          loading={targets.isLoading}
          placeholder={t.crmReminders.targetPlaceholder}
          searchPlaceholder={t.common.search}
          loadingLabel={t.common.loading}
          emptyLabel={t.crmReminders.targetsEmpty}
          clearLabel={t.common.dismiss}
        />
      </Field>

      <Field label={t.crmReminders.channel} hint={t.crmReminders.channelHint}>
        <Select
          value={channel}
          onValueChange={(next) => setChannel(next as CrmReminderChannel)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRM_REMINDER_CHANNELS.map((value) => (
              <SelectItem key={value} value={value}>
                {t.crmReminders.channelValues[value] ?? value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.crmReminders.remindAt} error={timeError} required>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-40 flex-1">
            <DatePicker
              value={day}
              onValueChange={(next) => {
                setPastError(undefined);
                setDay(next);
              }}
              placeholder={t.crmReminders.dayPlaceholder}
            />
          </div>
          {/* Two controls under one label: the day picker is what "Remind at"
              names, so the time input opts out of the field and keeps its own
              accessible name rather than claiming the same id. */}
          <FieldControlBoundary>
            <Input
              type="time"
              className="w-32"
              value={time}
              aria-label={t.crmReminders.timeOfDay}
              onChange={(input) => {
                setPastError(undefined);
                setTime(input.target.value);
              }}
            />
          </FieldControlBoundary>
        </div>
      </Field>
    </FormDrawer>
  );
}
