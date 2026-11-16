"use client";
import { DashboardRecoveryNotice, type DashboardRecoveryProps } from "./DashboardRecoveryNotice";
import { Field, FormDrawer, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { DASHBOARD_DESCRIPTION_MAX_LENGTH, DASHBOARD_NAME_MAX_LENGTH } from "../dashboard-contract";
import type { TemplateDefinition } from "../dashboard-catalog-contract";
import type { CreateDashboardInput } from "../hooks/useDashboards";
import { useDashboardCreateForm } from "../hooks/useDashboardCreateForm";
export function DashboardFormDrawer({ open, onOpenChange, onSubmit, templates, templatesUnavailable, canUseTemplates = true, blocked = false, isSubmitting, error, recovery, failureCode }: {
  open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (input: CreateDashboardInput) => void;
  templates: TemplateDefinition[]; templatesUnavailable: boolean; canUseTemplates?: boolean; blocked?: boolean; isSubmitting: boolean; error?: string; recovery?: DashboardRecoveryProps; failureCode?: string;
}) {
  const { t, lang } = useI18n(); const form = useDashboardCreateForm(onSubmit, canUseTemplates, blocked);
  return <FormDrawer open={open} onOpenChange={onOpenChange} title={t.crmDashboards.createTitle} description={t.crmDashboards.createDescription}
    isDirty={form.dirty} isSubmitting={isSubmitting} submitDisabled={form.disabled} onSubmit={form.submit} error={error}
    labels={{ submit: t.common.create, cancel: t.common.cancel, discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription, discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel }}>
    {recovery && <DashboardRecoveryNotice {...recovery} />}
    <Field showLabel label={t.crmDashboards.name} required error={form.nameInvalid ? t.crmDashboards.nameRequired : failureCode === "CRM_DASHBOARD_NAME_CONFLICT" ? error : undefined} hint={t.crmDashboards.review.nameLimit}>
      <Input value={form.name} maxLength={DASHBOARD_NAME_MAX_LENGTH} autoComplete="off" disabled={isSubmitting} onChange={(event) => form.changeName(event.target.value)} />
    </Field>
    <Field showLabel label={t.crmDashboards.description} hint={t.crmDashboards.review.descriptionLimit}><Textarea value={form.description} maxLength={DASHBOARD_DESCRIPTION_MAX_LENGTH} disabled={isSubmitting} onChange={(event) => form.setDescription(event.target.value)} /></Field>
    {templatesUnavailable && <p role="note" className="text-xs text-muted-foreground">{t.crmDashboards.catalogueUnavailable}</p>}
    {!canUseTemplates && <p role="note" className="text-xs text-muted-foreground">{t.crmDashboards.review.templatePermission}</p>}
    <Field showLabel label={t.crmDashboards.templateLabel} hint={t.crmDashboards.templateHint}><Select value={form.templateKey} onValueChange={form.setTemplateKey} disabled={isSubmitting || blocked}>
      <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__blank__">{t.crmDashboards.blankTemplate}</SelectItem>
        {canUseTemplates && !templatesUnavailable && templates.map((template) => <SelectItem key={template.key} value={template.key}>{`${localizedName(template, lang)} · ${formatTemplate(t.crmDashboards.widgetCount, { count: template.widgetCount })}`}</SelectItem>)}
      </SelectContent></Select></Field>
    <p className="text-xs text-muted-foreground">{t.crmDashboards.review.limits}</p>
  </FormDrawer>;
}



