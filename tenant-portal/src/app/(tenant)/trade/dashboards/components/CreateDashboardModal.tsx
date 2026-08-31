"use client";

import { useState } from "react";
import { Field, FormDrawer, Input, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { DASHBOARD_LIMITS } from "../analytics-contract";

interface CreateDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * A dashboard's scope is not asked for here.
 *
 * `CreateDashboardDto.scopeTargets` needs at least one company, and the only
 * company the portal can state without guessing is the one that owns the
 * selected branch — so the hook supplies it and the form collects the two
 * fields a person actually chooses.
 */
export function CreateDashboardModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateDashboardModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setName("");
          setDescription("");
          onClose();
        }
      }}
      title={t.tradeAnalytics.dashboardCreateTitle}
      description={t.tradeAnalytics.dashboardCreateDescription}
      isDirty={name.length > 0 || description.length > 0}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(name, description)}
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
      <div className="flex flex-col gap-3">
        <Field label={t.tradeAnalytics.dashboardName} required>
          <Input
            value={name}
            maxLength={DASHBOARD_LIMITS.nameMaxLength}
            disabled={isSubmitting}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label={t.tradeAnalytics.dashboardDescription}>
          <Textarea
            value={description}
            rows={3}
            maxLength={DASHBOARD_LIMITS.descriptionMaxLength}
            disabled={isSubmitting}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
      </div>
    </FormDrawer>
  );
}
