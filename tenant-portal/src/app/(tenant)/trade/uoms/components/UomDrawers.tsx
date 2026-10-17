"use client";

import { useState } from "react";
import { PencilRuler, Ruler } from "lucide-react";
import { Badge, cn, FormModal, IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDate } from "@/lib/format/date";
import {
  EMPTY_UOM_FORM,
  extractExtraLocales,
  toUomForm,
  validateUomForm,
  type Uom,
  type UomFormIssues,
  type UomFormValues,
} from "../uom-contract";
import {
  UomFormFields,
  UomWorkbenchAside,
  type UomCreateEntryMode,
  type UomFieldErrors,
} from "./UomFormFields";

interface UomDrawerProps {
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: UomFormValues) => Promise<boolean>;
}

type Dictionary = ReturnType<typeof useI18n>["t"];

function useModalLabels() {
  const { t } = useI18n();
  return {
    submit: t.trade.save,
    cancel: t.common.cancel,
    discardTitle: t.common.discardTitle,
    discardDescription: t.common.discardDescription,
    discardConfirm: t.common.discardConfirm,
    discardCancel: t.common.cancel,
    sections: t.trade.uomFormSections,
    sectionInvalid: t.trade.uomFormHasErrors,
    close: t.common.close,
  };
}

function translateUomIssues(issues: UomFormIssues, t: Dictionary): UomFieldErrors {
  return {
    code: issues.code ? t.trade.uomFormCode : undefined,
    displayName: issues.displayName ? t.trade.uomFormDisplayName : undefined,
    localizedNames: issues.localizedNames ? t.trade.uomFormNames : undefined,
  };
}

export function CreateUomDrawer({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
  initialEntryMode = "custom",
  existingCodes,
  isCodeTaken = false,
  onInspectExistingCode,
}: UomDrawerProps & {
  isOpen: boolean;
  initialEntryMode?: UomCreateEntryMode;
  existingCodes?: ReadonlySet<string>;
  isCodeTaken?: boolean;
  onInspectExistingCode?: (code: string) => void;
}) {
  const { t } = useI18n();
  const labels = useModalLabels();
  const [values, setValues] = useState<UomFormValues>(EMPTY_UOM_FORM);
  const [errors, setErrors] = useState<UomFieldErrors>({});
  const [entryMode, setEntryMode] = useState<UomCreateEntryMode>(initialEntryMode);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_UOM_FORM);

  const close = () => {
    setValues(EMPTY_UOM_FORM);
    setErrors({});
    setEntryMode("custom");
    onClose();
  };

  const handleChange = (patch: Partial<UomFormValues>, clear?: keyof UomFormIssues) => {
    setValues((current) => ({ ...current, ...patch }));
    if (clear) {
      setErrors((current) => ({ ...current, [clear]: undefined }));
    }
  };

  const handleBlur = (field: keyof UomFormIssues) => {
    if (field === "code" && values.code.trim().length === 0) return;
    if (field === "displayName" && values.displayName.trim().length === 0) return;
    if (
      field === "localizedNames" &&
      values.nameEn.trim().length === 0 &&
      values.nameAr.trim().length === 0
    ) {
      return;
    }
    const issues = validateUomForm(values);
    const translated = translateUomIssues(issues, t);
    setErrors((current) => ({ ...current, [field]: translated[field] }));
  };

  const handleSubmit = async () => {
    const issues = validateUomForm(values);
    const translated = translateUomIssues(issues, t);
    setErrors(translated);
    if (Object.values(translated).some(Boolean)) return;

    const saved = await onSubmit(values);
    if (saved) {
      setValues(EMPTY_UOM_FORM);
      setErrors({});
      setEntryMode("custom");
    }
  };

  return (
    <FormModal
      open={isOpen}
      size="wide"
      bodyClassName="bg-muted/35 dark:bg-background"
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={t.trade.uomCreateTitle}
      description={t.trade.uomCreateDescription}
      headerIcon={
        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border border-info/30 bg-info-subtle text-info-subtle-foreground">
          <Ruler className="size-5" aria-hidden="true" />
        </div>
      }
      titleBadge={
        <Badge
          tone="positive"
          className="gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium normal-case tracking-normal"
        >
          <span className="size-1.5 rounded-full bg-success-vivid" aria-hidden="true" />
          {t.trade.uomStatus_ACTIVE}
        </Badge>
      }
      headerAside={
        <span className="hidden text-xs text-muted-foreground sm:inline">
          <span className="me-1 font-semibold text-destructive">*</span>
          {t.trade.uomRequiredFields}
        </span>
      }
      asideSlot={
        <UomWorkbenchAside
          values={values}
          codeReadOnly={false}
          onSelectPreset={(patch) => {
            handleChange(patch, "code");
            setEntryMode("custom");
          }}
        />
      }
      footerLeading={
        <span className="text-xs text-muted-foreground">{t.trade.uomFooterHint}</span>
      }
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void handleSubmit()}
      error={error ?? undefined}
      labels={labels}
    >
      <UomFormFields
        values={values}
        errors={errors}
        onChange={handleChange}
        onBlur={handleBlur}
        isSubmitting={isSubmitting}
        codeReadOnly={false}
        showStatus={false}
        entryMode={entryMode}
        onEntryModeChange={setEntryMode}
        existingCodes={existingCodes}
        isCodeTaken={isCodeTaken || error === t.trade.uomCodeTaken}
        onInspectExistingCode={onInspectExistingCode}
      />
    </FormModal>
  );
}

export function EditUomDrawer({
  uom,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: UomDrawerProps & { uom: Uom }) {
  const { t, lang } = useI18n();
  const labels = useModalLabels();
  const initial: UomFormValues = {
    ...toUomForm(uom),
    extraLocales: extractExtraLocales(uom.localizedNames),
  };
  const [values, setValues] = useState<UomFormValues>(initial);
  const [errors, setErrors] = useState<UomFieldErrors>({});
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  const handleChange = (patch: Partial<UomFormValues>, clear?: keyof UomFormIssues) => {
    setValues((current) => ({ ...current, ...patch }));
    if (clear) {
      setErrors((current) => ({ ...current, [clear]: undefined }));
    }
  };

  const handleBlur = (field: keyof UomFormIssues) => {
    const issues = validateUomForm(values, {
      codeReadOnly: true,
      currentNames: uom.localizedNames,
    });
    const translated = translateUomIssues(issues, t);
    setErrors((current) => ({ ...current, [field]: translated[field] }));
  };

  const handleSubmit = async () => {
    const issues = validateUomForm(values, {
      codeReadOnly: true,
      currentNames: uom.localizedNames,
    });
    const translated = translateUomIssues(issues, t);
    setErrors(translated);
    if (Object.values(translated).some(Boolean)) return;

    await onSubmit(values);
  };

  return (
    <FormModal
      open
      size="wide"
      bodyClassName="bg-muted/35 dark:bg-background"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.trade.uomEditTitle}
      description={t.trade.uomEditDescription}
      headerIcon={
        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border border-info/30 bg-info-subtle text-info-subtle-foreground">
          <PencilRuler className="size-5" aria-hidden="true" />
        </div>
      }
      titleBadge={
        <>
          <IdentifierText className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
            {uom.code}
          </IdentifierText>
          <Badge
            tone={values.status === "ACTIVE" ? "positive" : "neutral"}
            className="gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium normal-case tracking-normal"
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                values.status === "ACTIVE" ? "bg-success-vivid" : "bg-current",
              )}
              aria-hidden="true"
            />
            {t.trade[`uomStatus_${values.status}`]}
          </Badge>
        </>
      }
      headerAside={
        <span className="hidden text-xs text-muted-foreground sm:inline">
          <span className="me-1 font-semibold text-destructive">*</span>
          {t.trade.uomRequiredFields}
        </span>
      }
      asideSlot={
        <UomWorkbenchAside
          values={values}
          codeReadOnly
          uom={uom}
        />
      }
      footerLeading={
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <IdentifierText>v{uom.version}</IdentifierText>
          <span aria-hidden="true">·</span>
          <span>
            {t.trade.updatedAt} {formatDate(uom.updatedAt, lang)}
          </span>
        </span>
      }
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void handleSubmit()}
      error={error ?? undefined}
      labels={labels}
    >
      <UomFormFields
        values={values}
        errors={errors}
        onChange={handleChange}
        onBlur={handleBlur}
        isSubmitting={isSubmitting}
        codeReadOnly
        showStatus
      />
    </FormModal>
  );
}
