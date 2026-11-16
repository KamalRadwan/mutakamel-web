"use client";

import { ShieldCheck } from "lucide-react";
import { Badge, Button, DegradedBanner, Field, FormModal, Switch } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { CRM_FIELD_REQUIREMENT_OPERATIONS } from "../custom-field-contract";
import type { useCustomFieldRequirements } from "../hooks/useCustomFieldRequirements";

export function CustomFieldRequirementsDrawer({ requirements }: {
  requirements: ReturnType<typeof useCustomFieldRequirements>;
}) {
  const { t, lang } = useI18n();
  return (
    <FormModal size="card" density="compact" open={requirements.field !== null}
      onOpenChange={(open) => { if (!open) requirements.close(); }}
      title={t.crmCustomFields.requirementsTitle} description={t.crmCustomFields.requirementsDescription}
      headerIcon={<ShieldCheck className="size-5 text-primary" aria-hidden="true" />}
      isDirty={requirements.isDirty} isSubmitting={requirements.isSubmitting}
      submitDisabled={!requirements.isDirty || !requirements.canChange}
      error={requirements.error ?? undefined} onSubmit={() => void requirements.save()}
      footerLeading={<p className="text-xs text-muted-foreground">{t.crmCustomFields.requirementsSaveNote}</p>}
      labels={{ submit: t.common.save, cancel: t.common.cancel, discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription, discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel,
        sections: t.crmCustomFields.requirementsTitle, sectionInvalid: t.crmCustomFields.invalidNames }}>
      {requirements.field ? <div className="flex flex-col gap-1 border-b border-border pb-2">
        <p className="text-sm font-medium">{localizedValue(requirements.field.nameAr, requirements.field.nameEn, lang)}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{t.crmCustomFields.ownerTypes[requirements.field.ownerType]}</span>
          <code className="font-mono" dir="ltr">{requirements.field.fieldKey}</code>
        </div>
      </div> : null}
      {requirements.field && !requirements.field.isActive ? <DegradedBanner message={t.crmCustomFields.inactiveRequirements} /> : null}
      {requirements.needsReload ? <Button variant="outline" size="sm" disabled={requirements.isSubmitting} onClick={() => void requirements.refresh()}>
        {t.crmCustomFields.requirementsReload}
      </Button> : null}
      <div className="divide-y divide-border">
        {CRM_FIELD_REQUIREMENT_OPERATIONS.map((operation) => (
          <div key={operation} className="flex items-center justify-between gap-4 py-3">
            <Field label={t.crmCustomFields.requirementOperations[operation]} showLabel className="flex-1"
              hint={operation === "CONVERT" && requirements.field?.ownerType === "OPPORTUNITY" ?
                t.crmCustomFields.conversionUnavailable : t.crmCustomFields.requirementHints[operation]}>
              <Switch checked={requirements.flags[operation]}
                disabled={!requirements.canChange || (operation === "CONVERT" && requirements.field?.ownerType === "OPPORTUNITY")}
                onCheckedChange={(checked) => requirements.change(operation, checked)} />
            </Field>
            <Badge tone={operation === "CONVERT" && requirements.field?.ownerType === "OPPORTUNITY" ? "neutral" :
              requirements.flags[operation] ? "caution" : "neutral"}>
              {operation === "CONVERT" && requirements.field?.ownerType === "OPPORTUNITY" ? t.crmCustomFields.unavailableOperation :
                requirements.flags[operation] ? t.crmCustomFields.required : t.crmCustomFields.optional}
            </Badge>
          </div>
        ))}
      </div>
      {requirements.field?.requirements.some((rule) => rule.entityScope !== null) ? (
        <section className="flex flex-col gap-2 rounded-md border border-border bg-muted/25 p-2">
          <p className="text-xs text-muted-foreground">{t.crmCustomFields.scopedRulesReadOnly}</p>
          <ul className="flex flex-col gap-1">
            {requirements.field.requirements.filter((rule) => rule.entityScope !== null).map((rule) => (
              <li key={rule.operation + "-" + rule.entityScope} className="flex flex-wrap items-center gap-2 text-xs">
                <span>{rule.entityScope ? t.crmCustomFields.ownerTypes[rule.entityScope] : ""}</span>
                <span>{t.crmCustomFields.requirementOperations[rule.operation]}</span>
                <Badge tone={rule.isRequired ? "caution" : "neutral"}>{rule.isRequired ? t.crmCustomFields.required : t.crmCustomFields.optional}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-xs text-muted-foreground">{t.crmCustomFields.requirementsScopeNote}</p>
    </FormModal>
  );
}
