"use client";

import { useState } from "react";
import {
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
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import {
  DASHBOARD_DESCRIPTION_MAX_LENGTH,
  DASHBOARD_NAME_MAX_LENGTH,
  type DashboardTemplateKey,
} from "../dashboard-contract";
import type { TemplateDefinition } from "../dashboard-catalog-contract";
import type { CreateDashboardInput } from "../hooks/useDashboards";

interface DashboardFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateDashboardInput) => void;
  templates: TemplateDefinition[];
  templatesUnavailable: boolean;
  isSubmitting: boolean;
  error?: string;
}

const BLANK_TEMPLATE = "__blank__";

/**
 * Create only.
 *
 * `templateKey` is offered on `POST /dashboards` rather than through
 * `POST /from-template/:key` because the former takes a name, a description
 * **and** a template in one request, and the two paths otherwise produce the
 * same dashboard (`DashboardDefinitionsService.create` calls the same
 * `templates.createFromTemplate`).
 */
export function DashboardFormDrawer({
  open,
  onOpenChange,
  onSubmit,
  templates,
  templatesUnavailable,
  isSubmitting,
  error,
}: DashboardFormDrawerProps) {
  const { t, lang } = useI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateKey, setTemplateKey] = useState<string>(BLANK_TEMPLATE);
  const [touched, setTouched] = useState(false);

  const nameError =
    touched && name.trim().length === 0 ? t.crmDashboards.nameRequired : undefined;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t.crmDashboards.createTitle}
      description={t.crmDashboards.createDescription}
      isDirty={name.length > 0 || description.length > 0 || templateKey !== BLANK_TEMPLATE}
      isSubmitting={isSubmitting}
      submitDisabled={name.trim().length === 0}
      onSubmit={() => {
        setTouched(true);
        if (name.trim().length === 0) return;
        onSubmit({
          name,
          description,
          templateKey:
            templateKey === BLANK_TEMPLATE ? null : (templateKey as DashboardTemplateKey),
        });
      }}
      error={error}
      labels={{
        submit: t.common.create,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <Field label={t.crmDashboards.name} error={nameError} required>
        <Input
          value={name}
          maxLength={DASHBOARD_NAME_MAX_LENGTH}
          autoComplete="off"
          onChange={(event) => {
            setTouched(true);
            setName(event.target.value);
          }}
        />
      </Field>

      <Field label={t.crmDashboards.description}>
        <Textarea
          value={description}
          maxLength={DASHBOARD_DESCRIPTION_MAX_LENGTH}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      {templatesUnavailable ? (
        <p role="note" className="text-xs text-muted-foreground">
          {t.crmDashboards.catalogueUnavailable}
        </p>
      ) : (
        <Field label={t.crmDashboards.templateLabel} hint={t.crmDashboards.templateHint}>
          <Select value={templateKey} onValueChange={setTemplateKey}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={BLANK_TEMPLATE}>{t.crmDashboards.blankTemplate}</SelectItem>
              {templates.map((template) => (
                <SelectItem key={template.key} value={template.key}>
                  {`${localizedName(template, lang)} · ${formatTemplate(t.crmDashboards.widgetCount, {
                    count: template.widgetCount,
                  })}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </FormDrawer>
  );
}
