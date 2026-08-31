"use client";

import { useState } from "react";
import {
  DatePicker,
  EditDrawer,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  ACTIVITY_SUBJECT_MAX_LENGTH,
  CRM_TASK_STATUSES,
  type CrmTask,
  type CrmTaskStatus,
  type UpdateTaskInput,
} from "../../activities/activity-contract";

interface EditTaskDrawerProps {
  task: CrmTask | null;
  isSubmitting: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (input: UpdateTaskInput) => void;
}

/**
 * `PATCH /tasks/:id`.
 *
 * Only the three fields the LIST returns are editable here. `description`,
 * `priority` and `assigneeUserId` are writable on the route but absent from
 * `listScopedTasks`' projection, so this form has no current value to show for
 * them — and a blank input submitted over a value the user never saw would
 * silently erase it. The drawer says so rather than pretending otherwise.
 */
export function EditTaskDrawer({
  task,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: EditTaskDrawerProps) {
  const { t } = useI18n();
  // Seeded once; the caller remounts this drawer per task it opens for.
  const [title, setTitle] = useState(task?.title ?? "");
  const [status, setStatus] = useState<CrmTaskStatus>(task?.status ?? "OPEN");
  const [dueAt, setDueAt] = useState<Date | undefined>(
    task?.dueAt ? new Date(task.dueAt) : undefined,
  );

  const baselineDueAt = task?.dueAt ? new Date(task.dueAt).getTime() : null;
  const isDirty =
    task !== null &&
    (title !== task.title ||
      status !== task.status ||
      (dueAt?.getTime() ?? null) !== baselineDueAt);
  const titleError =
    title.trim().length === 0 ? t.crmTasks.titleRequired : undefined;

  return (
    <EditDrawer
      open={task !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.crmTasks.editTitle}
      description={t.crmTasks.editDescription}
      notFound={false}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      error={error}
      onRevert={() => {
        setTitle(task?.title ?? "");
        setStatus(task?.status ?? "OPEN");
        setDueAt(task?.dueAt ? new Date(task.dueAt) : undefined);
      }}
      onSubmit={() => {
        if (titleError) return;
        onSubmit({ title, status, dueAt: dueAt ?? null });
      }}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        loadErrorTitle: t.crmTasks.loadFailed,
        retry: t.common.retry,
        notFoundTitle: t.crmTasks.loadFailed,
        notFoundBack: t.common.back,
        revert: t.crmTasks.revert,
      }}
    >
      <Field label={t.crmTasks.title} error={titleError} required>
        <Input
          value={title}
          maxLength={ACTIVITY_SUBJECT_MAX_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
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

      <Field label={t.crmTasks.dueAt}>
        <DatePicker
          value={dueAt}
          onValueChange={setDueAt}
          placeholder={t.crmTasks.dueAtPlaceholder}
          clearLabel={t.common.dismiss}
        />
      </Field>

      <p className="text-xs text-muted-foreground">
        {t.crmTasks.projectionNote}
      </p>
    </EditDrawer>
  );
}
