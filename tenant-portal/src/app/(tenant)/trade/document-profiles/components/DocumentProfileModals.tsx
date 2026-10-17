"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  FileCode2,
  FileText,
  Lock,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  Badge,
  Button,
  Field,
  FormModal,
  IdentifierText,
  Input,
  SWATCH_SURFACE_PALETTES,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
  type SwatchHue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  CREATABLE_DOCUMENT_TYPES,
  DOCUMENT_PROFILE_REGISTRIES,
  DOCUMENT_PROFILE_SCOPE_TARGETS,
  EMPTY_DOCUMENT_PROFILE_FORM,
  EMPTY_DOCUMENT_PROFILE_VERSION_FORM,
  MANDATORY_COMPILED_CASE_CODES,
  SERVER_OWNED_FIELDS,
  buildDefaultVisualProfileConfig,
  serializeVisualProfileContent,
  type CreatableDocumentType,
  type DocumentProfileFormValues,
  type DocumentProfileVersionFormValues,
  type DocumentProfileVisualConfig,
} from "../document-profile-contract";

const modalLabels = (t: ReturnType<typeof useI18n>["t"], sectionsTitle: string) => ({
  submit: t.common.save,
  cancel: t.common.cancel,
  discardTitle: t.common.discardTitle,
  discardDescription: t.common.discardDescription,
  discardConfirm: t.common.discardConfirm,
  discardCancel: t.common.cancel,
  sections: sectionsTitle,
  sectionInvalid: t.tradeCommon.actionFailed,
});

const DOC_TYPE_HUES: Record<CreatableDocumentType, SwatchHue> = {
  QUOTATION: "blue",
  SALES_ORDER: "indigo",
  PURCHASE_ORDER: "teal",
};

export function CreateDocumentProfileModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: DocumentProfileFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}) {
  const { t } = useI18n();
  const [values, setValues] = useState<DocumentProfileFormValues>(EMPTY_DOCUMENT_PROFILE_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_DOCUMENT_PROFILE_FORM);

  const activePalette = SWATCH_SURFACE_PALETTES[DOC_TYPE_HUES[values.documentType] ?? "indigo"];
  const registry = DOCUMENT_PROFILE_REGISTRIES[values.documentType];

  return (
    <FormModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_DOCUMENT_PROFILE_FORM);
          onClose();
        }
      }}
      size="wide"
      title={t.tradeGovernance.profileCreateTitle}
      description={t.tradeGovernance.profileCreateDescription}
      headerIcon={
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border",
            activePalette.iconBoxIdle,
          )}
        >
          <FileText className="size-4" aria-hidden="true" />
        </div>
      }
      titleBadge={
        <Badge tone="brand">
          {tradeStatusLabel(t.tradeStatus, values.documentType, t.common.unknownCode)}
        </Badge>
      }
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      asideSlot={
        <div className="flex flex-col gap-3 p-4">
          <div className={cn("rounded-lg border p-3.5", activePalette.sectionCard)}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                {t.tradePricing.livePreviewTitle}
              </span>
              <Badge tone="neutral">{values.scopeTarget}</Badge>
            </div>
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{t.tradeGovernance.code}</span>
                <IdentifierText className="text-xs font-semibold text-foreground">
                  {values.code.trim().toUpperCase() || "DP_STD_PROFILE"}
                </IdentifierText>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {t.tradeGovernance.documentType}
                </span>
                <IdentifierText className="text-xs font-semibold text-foreground">
                  {values.documentType}
                </IdentifierText>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {t.tradeGovernance.profileHeaderFieldsLabel}
                </span>
                <Badge tone="brand">{String(registry.headerFields.length)}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {t.tradeGovernance.profileLineFieldsLabel}
                </span>
                <Badge tone="brand">{String(registry.lineFields.length)}</Badge>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "flex items-start gap-2.5 rounded-lg border p-3 text-xs",
              SWATCH_SURFACE_PALETTES.amber.sectionCard,
            )}
          >
            <ShieldAlert
              className={cn("mt-0.5 size-4 shrink-0", SWATCH_SURFACE_PALETTES.amber.iconText)}
              aria-hidden="true"
            />
            <span className="text-foreground">{t.tradeGovernance.profileScopeBranchForbidden}</span>
          </div>
        </div>
      }
      labels={modalLabels(t, t.tradeGovernance.profileCreateTitle)}
    >
      <div className="flex flex-col gap-4">
        <Field
          label={t.tradeGovernance.code}
          hint={t.tradeGovernance.codeHint}
          showLabel
          hintPlacement="tooltip"
          required
        >
          <Input
            size="sm"
            dir="ltr"
            className="font-mono uppercase"
            placeholder="DP_SALES_ORDER_ENTERPRISE"
            value={values.code}
            maxLength={100}
            disabled={isSubmitting}
            onChange={(event) =>
              setValues((current) => ({ ...current, code: event.target.value.toUpperCase() }))
            }
          />
        </Field>

        {/* Colorful Document Type Archetype Cards */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {CREATABLE_DOCUMENT_TYPES.map((docType) => {
            const palette = SWATCH_SURFACE_PALETTES[DOC_TYPE_HUES[docType]];
            const isSelected = values.documentType === docType;
            return (
              <Button
                key={docType}
                type="button"
                variant="ghost"
                disabled={isSubmitting}
                onClick={() =>
                  setValues((current) => ({
                    ...current,
                    documentType: docType,
                  }))
                }
                className={cn(
                  "h-auto flex-col items-start justify-start gap-1.5 rounded-lg border p-3 text-start whitespace-normal",
                  isSelected ? palette.tileActive : palette.tileIdle,
                )}
              >
                <IdentifierText className="text-xs font-semibold">{docType}</IdentifierText>
                <span className="text-xs font-semibold text-foreground">
                  {tradeStatusLabel(t.tradeStatus, docType, t.common.unknownCode)}
                </span>
              </Button>
            );
          })}
        </div>

        <Field
          label={t.tradeGovernance.documentType}
          hint={t.tradeGovernance.documentTypeHint}
          showLabel
          hintPlacement="tooltip"
          required
        >
          <Select
            value={values.documentType}
            disabled={isSubmitting}
            onValueChange={(next) =>
              setValues((current) => ({
                ...current,
                documentType: next as DocumentProfileFormValues["documentType"],
              }))
            }
          >
            <SelectTrigger size="sm" aria-label={t.tradeGovernance.documentType}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CREATABLE_DOCUMENT_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={t.tradeGovernance.scopeTarget}
          hint={t.tradeGovernance.profileScopeBranchForbidden}
          showLabel
          hintPlacement="tooltip"
          required
        >
          <Select
            value={values.scopeTarget}
            disabled={isSubmitting}
            onValueChange={(next) =>
              setValues((current) => ({
                ...current,
                scopeTarget: next as DocumentProfileFormValues["scopeTarget"],
              }))
            }
          >
            <SelectTrigger size="sm" aria-label={t.tradeGovernance.scopeTarget}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_PROFILE_SCOPE_TARGETS.map((value) => (
                <SelectItem key={value} value={value}>
                  {tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </FormModal>
  );
}

export function CreateDocumentProfileVersionDrawer({
  profileCode,
  documentType = "QUOTATION",
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  profileCode: string;
  documentType?: string;
  onClose: () => void;
  onSubmit: (values: DocumentProfileVersionFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}) {
  const { t } = useI18n();
  const resolvedDocType: CreatableDocumentType =
    documentType === "SALES_ORDER" || documentType === "PURCHASE_ORDER"
      ? documentType
      : "QUOTATION";

  const [visualConfig, setVisualConfig] = useState<DocumentProfileVisualConfig>(() =>
    buildDefaultVisualProfileConfig(resolvedDocType),
  );
  const [values, setValues] = useState<DocumentProfileVersionFormValues>(() => ({
    ...EMPTY_DOCUMENT_PROFILE_VERSION_FORM,
    content: serializeVisualProfileContent(buildDefaultVisualProfileConfig(resolvedDocType)),
  }));
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_DOCUMENT_PROFILE_VERSION_FORM);

  const applyVisualConfig = (next: DocumentProfileVisualConfig) => {
    setVisualConfig(next);
    const contentJson = serializeVisualProfileContent(next);
    setValues((current) => ({
      ...current,
      content: contentJson,
    }));
  };

  const toggleFieldRequired = (fieldCode: string) => {
    const nextFields = visualConfig.fields.map((f) =>
      f.code === fieldCode && !f.mandatory ? { ...f, required: !f.required } : f,
    );
    applyVisualConfig({ ...visualConfig, fields: nextFields });
  };

  const toggleComponentVisible = (compCode: string) => {
    const nextComponents = visualConfig.components.map((c) =>
      c.code === compCode ? { ...c, visible: !c.visible } : c,
    );
    applyVisualConfig({ ...visualConfig, components: nextComponents });
  };

  const serverOwnedWarning = useMemo(
    () =>
      formatTemplate(t.tradeGovernance.serverOwnedFieldsGuard, {
        fields: SERVER_OWNED_FIELDS.join(", "),
      }),
    [t.tradeGovernance.serverOwnedFieldsGuard],
  );

  const headerFields = visualConfig.fields.filter((f) => f.section === "header");
  const lineFields = visualConfig.fields.filter((f) => f.section === "line");

  return (
    <FormModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="full"
      title={`${t.tradeGovernance.profileVersionCreateTitle} · ${profileCode}`}
      description={t.tradeGovernance.profileVersionCreateDescription}
      headerIcon={
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border",
            SWATCH_SURFACE_PALETTES.indigo.iconBoxIdle,
          )}
        >
          <FileCode2 className="size-4" aria-hidden="true" />
        </div>
      }
      titleBadge={<Badge tone="brand">{resolvedDocType}</Badge>}
      headerAside={
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => applyVisualConfig(visualConfig)}
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          {t.tradeGovernance.profileRegistryBuilderTitle}
        </Button>
      }
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      asideSlot={
        <div className="flex flex-col gap-3 p-4">
          <div
            className={cn(
              "rounded-lg border p-3.5",
              SWATCH_SURFACE_PALETTES.green.sectionCard,
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <CheckCircle2
                  className={cn("size-4", SWATCH_SURFACE_PALETTES.green.iconText)}
                  aria-hidden="true"
                />
                {t.tradeGovernance.requiredCases}
              </span>
              <Badge tone="positive">{t.tradeGovernance.mandatoryCasesCountBadge}</Badge>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t.tradeGovernance.profileMandatoryCasesBanner}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {MANDATORY_COMPILED_CASE_CODES.map((code) => (
                <IdentifierText
                  key={code}
                  className="rounded border border-border bg-card px-2 py-0.5 text-xs font-semibold text-foreground"
                >
                  {code}
                </IdentifierText>
              ))}
            </div>
          </div>

          <div
            className={cn(
              "rounded-lg border p-3.5",
              SWATCH_SURFACE_PALETTES.amber.sectionCard,
            )}
          >
            <span className="text-xs font-semibold text-foreground">
              {t.tradeGovernance.serverOwnedGuardTitle}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">{serverOwnedWarning}</p>
          </div>
        </div>
      }
      labels={modalLabels(t, t.tradeGovernance.profileVersionCreateTitle)}
    >
      <div className="flex flex-col gap-5">
        {/* Effective Window */}
        <div
          className={cn(
            "grid gap-3 rounded-lg border p-4 md:grid-cols-2",
            SWATCH_SURFACE_PALETTES.indigo.sectionCard,
          )}
        >
          <Field
            label={t.tradeGovernance.effectiveFrom}
            hint={t.tradePricing.guideEffectiveFrom}
            showLabel
            hintPlacement="tooltip"
            required
          >
            <Input
              size="sm"
              placeholder={t.tradeGovernance.effectiveFrom}
              type="datetime-local"
              value={values.effectiveFrom}
              disabled={isSubmitting}
              onChange={(event) =>
                setValues((current) => ({ ...current, effectiveFrom: event.target.value }))
              }
            />
          </Field>
          <Field
            label={t.tradeGovernance.effectiveTo}
            hint={t.tradeGovernance.effectiveToHint}
            showLabel
            hintPlacement="tooltip"
          >
            <Input
              size="sm"
              placeholder={t.tradeGovernance.effectiveTo}
              type="datetime-local"
              value={values.effectiveTo}
              disabled={isSubmitting}
              onChange={(event) =>
                setValues((current) => ({ ...current, effectiveTo: event.target.value }))
              }
            />
          </Field>
        </div>

        {/* Registry-Guided Schema Builder */}
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-muted/20 p-4 md:grid-cols-3">
          {/* Header Fields */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-foreground">
              {t.tradeGovernance.profileHeaderFieldsLabel}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {headerFields.map((field) => (
                <Button
                  key={field.code}
                  type="button"
                  size="xs"
                  variant={field.required ? "primary" : "outline"}
                  disabled={isSubmitting || field.mandatory}
                  onClick={() => toggleFieldRequired(field.code)}
                >
                  <IdentifierText className="text-xs">{field.code}</IdentifierText>
                </Button>
              ))}
            </div>
          </div>

          {/* Line Fields */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-foreground">
              {t.tradeGovernance.profileLineFieldsLabel}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {lineFields.map((field) => (
                <Button
                  key={field.code}
                  type="button"
                  size="xs"
                  variant={field.required ? "primary" : "outline"}
                  disabled={isSubmitting || field.mandatory}
                  onClick={() => toggleFieldRequired(field.code)}
                >
                  <IdentifierText className="text-xs">{field.code}</IdentifierText>
                </Button>
              ))}
            </div>
          </div>

          {/* Enabled Components */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-foreground">
              {t.tradeGovernance.profileComponentsLabel}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {visualConfig.components.map((comp) => (
                <Button
                  key={comp.code}
                  type="button"
                  size="xs"
                  variant={comp.visible ? "primary" : "outline"}
                  disabled={isSubmitting}
                  onClick={() => toggleComponentVisible(comp.code)}
                >
                  <IdentifierText className="text-xs">{comp.code}</IdentifierText>
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Synced JSON Payloads */}
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label={t.tradeGovernance.content}
            hint={t.tradeGovernance.contentHint}
            showLabel
            hintPlacement="tooltip"
            required
          >
            <Textarea
              dir="ltr"
              className="font-mono text-xs"
              placeholder={t.tradeGovernance.content}
              value={values.content}
              rows={8}
              disabled={isSubmitting}
              onChange={(event) =>
                setValues((current) => ({ ...current, content: event.target.value }))
              }
            />
          </Field>
          <Field
            label={t.tradeGovernance.requiredCases}
            hint={t.tradeGovernance.requiredCasesHint}
            showLabel
            hintPlacement="tooltip"
          >
            <Textarea
              dir="ltr"
              className="font-mono text-xs"
              placeholder={t.tradeGovernance.requiredCases}
              value={values.requiredCases}
              rows={8}
              disabled={isSubmitting}
              onChange={(event) =>
                setValues((current) => ({ ...current, requiredCases: event.target.value }))
              }
            />
          </Field>
        </div>
      </div>
    </FormModal>
  );
}

export function PublishDocumentProfileVersionModal({
  defaultPointerVersion = 0,
  versionRowNumber,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  defaultPointerVersion?: number;
  versionRowNumber?: number;
  onClose: () => void;
  onSubmit: (pointerVersion: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}) {
  const { t } = useI18n();
  const initialStr = String(defaultPointerVersion);
  const [pointerVersion, setPointerVersion] = useState(initialStr);

  return (
    <FormModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="card"
      title={t.tradeGovernance.profilePublishTitle}
      description={t.tradeGovernance.profilePublishDescription}
      headerIcon={
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border",
            SWATCH_SURFACE_PALETTES.green.iconBoxIdle,
          )}
        >
          <Lock className="size-4" aria-hidden="true" />
        </div>
      }
      titleBadge={<Badge tone="positive">{t.tradeGovernance.dualLockBadge}</Badge>}
      isDirty={pointerVersion !== initialStr}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(pointerVersion)}
      error={error ?? undefined}
      labels={modalLabels(t, t.tradeGovernance.profilePublishTitle)}
    >
      <div className="flex flex-col gap-4">
        <div
          className={cn(
            "grid grid-cols-2 gap-3 rounded-lg border p-3 text-xs",
            SWATCH_SURFACE_PALETTES.indigo.sectionCard,
          )}
        >
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">{t.tradeGovernance.headerLockLabel}</span>
            <IdentifierText className="font-semibold text-foreground">
              {`"${versionRowNumber ?? 1}"`}
            </IdentifierText>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">{t.tradeGovernance.bodyLockLabel}</span>
            <IdentifierText className="font-semibold text-foreground">
              {pointerVersion}
            </IdentifierText>
          </div>
        </div>

        <Field
          label={t.tradeGovernance.expectedActivePointerVersion}
          hint={formatTemplate(t.tradeGovernance.pointerAutoFilledHint, {
            version: defaultPointerVersion,
          })}
          showLabel
          hintPlacement="tooltip"
          required
        >
          <Input
            size="sm"
            dir="ltr"
            className="font-mono tabular-nums"
            placeholder={t.tradeGovernance.expectedActivePointerVersion}
            type="number"
            min={0}
            value={pointerVersion}
            disabled={isSubmitting}
            onChange={(event) => setPointerVersion(event.target.value)}
          />
        </Field>
      </div>
    </FormModal>
  );
}
