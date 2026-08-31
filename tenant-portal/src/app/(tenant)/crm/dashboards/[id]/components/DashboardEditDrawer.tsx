"use client";

import { useState } from "react";
import { Field, FormDrawer, Input, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  DASHBOARD_DESCRIPTION_MAX_LENGTH,
  DASHBOARD_NAME_MAX_LENGTH,
} from "../../dashboard-contract";

interface DashboardEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  initialDescription: string;
  isSubmitting: boolean;
  error?: string;
  onSubmit: (name: string, description: string) => void;
}

/**
 * `PATCH /dashboards/:id` — name and description only.
 *
 * `defaultFilters` is deliberately not edited here. It is a
 * `DashboardFiltersDto` whose eleven keys include `ownerUserId` and
 * `pipelineId`, and this screen has no picker for either; a partial editor
 * would rewrite the whole object and silently drop the keys it cannot show.
 * The run filter bar changes the *current* run without touching the stored
 * default.
 */
export function DashboardEditDrawer({
  open,
  onOpenChange,
  initialName,
  initialDescription,
  isSubmitting,
  error,
  onSubmit,
}: DashboardEditDrawerProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t.crmDashboards.editTitle}
      description={t.crmDashboards.editDescription}
      isDirty={name !== initialName || description !== initialDescription}
      isSubmitting={isSubmitting}
      submitDisabled={name.trim().length === 0}
      onSubmit={() => {
        if (name.trim().length > 0) onSubmit(name, description);
      }}
      error={error}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <Field label={t.crmDashboards.name} required>
        <Input
          value={name}
          maxLength={DASHBOARD_NAME_MAX_LENGTH}
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label={t.crmDashboards.description}>
        <Textarea
          value={description}
          maxLength={DASHBOARD_DESCRIPTION_MAX_LENGTH}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <p className="text-xs text-muted-foreground">{t.crmDashboards.editFiltersNote}</p>
    </FormDrawer>
  );
}
