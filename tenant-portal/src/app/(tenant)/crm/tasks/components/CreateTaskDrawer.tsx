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
  ACTIVITY_SUBJECT_MAX_LENGTH,
  ACTIVITY_TEXT_MAX_LENGTH,
  CRM_PRIORITIES,
  CRM_TASK_STATUSES,
  type CreateTaskInput,
  type CrmPriority,
  type CrmTaskStatus,
} from "../../activities/activity-contract";

interface CreateTaskDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  isSubmitting: boolean;
  error?: string;
  onSubmit: (input: CreateTaskInput) => void;
}

export function CreateTaskDrawer({
  open,
  onOpenChange,
  branchId,
  isSubmitting,
  error,
  onSubmit,
}: CreateTaskDrawerProps) {
  const { t } = useI18n();
  const [sourceType, setSourceType] = useState<CrmWorkSourceType>("LEAD");
  const [sourceId, setSourceId] = useState<string | undefined>(undefined);
  const [sourceLabel, setSourceLabel] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<CrmTaskStatus>("OPEN");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<CrmPriority | "">("");
  const [dueAt, setDueAt] = useState<Date | undefined>(undefined);
  const records = useCrmRecordOptions(sourceType, branchId);

  const titleError =
    title.trim().length === 0 ? t.crmTasks.titleRequired : undefined;
  const sourceError = sourceId ? undefined : t.crmTasks.sourceRequired;
  const isDirty = title.length > 0 || sourceId !== undefined;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t.crmTasks.createTitle}
      description={t.crmTasks.createDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      submitDisabled={Boolean(titleError || sourceError)}
      error={error}
      onSubmit={() => {
        if (titleError || !sourceId) return;
        onSubmit({
          branchId,
          title,
          sourceType,
          sourceId,
          status,
          description,
          priority,
          dueAt: dueAt ?? null,
        });
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
      {records.error ? (
        <DegradedBanner message={t.crmTasks.recordsUnavailable} />
      ) : null}

      <Field label={t.crmTasks.title} error={titleError} required>
        <Input
          value={title}
          maxLength={ACTIVITY_SUBJECT_MAX_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      <Field label={t.crmTasks.sourceType} hint={t.crmTasks.sourceTypeHint}>
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

      <Field label={t.crmTasks.sourceRecord} error={sourceError} required>
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
          placeholder={t.crmTasks.sourceRecordPlaceholder}
          searchPlaceholder={t.common.search}
          loadingLabel={t.common.loading}
          emptyLabel={t.crmTasks.recordsEmpty}
          clearLabel={t.common.dismiss}
        />
      </Field>

      <Field label={t.common.status}>
        <Select
          value={status}
          onValueChange={(next) => setStatus(next as CrmTaskStatus)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRM_TASK_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t.statusValues[`CrmTaskStatus.${value}`] ?? value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.crmTasks.priority} hint={t.crmTasks.priorityHint}>
        <Select
          value={priority || undefined}
          onValueChange={(next) => setPriority(next as CrmPriority)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t.crmTasks.priorityUnset} />
          </SelectTrigger>
          <SelectContent>
            {CRM_PRIORITIES.map((value) => (
              <SelectItem key={value} value={value}>
                {t.crmTasks.priorityValues[value] ?? value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.crmTasks.dueAt}>
        <DatePicker
          value={dueAt}
          onValueChange={setDueAt}
          placeholder={t.crmTasks.dueAtPlaceholder}
          clearLabel={t.common.dismiss}
        />
      </Field>

      <Field label={t.crmTasks.description} hint={t.crmTasks.descriptionHint}>
        <Textarea
          value={description}
          maxLength={ACTIVITY_TEXT_MAX_LENGTH}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
    </FormDrawer>
  );
}
