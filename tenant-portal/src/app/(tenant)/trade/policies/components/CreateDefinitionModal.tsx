"use client";

import { useState } from "react";
import { GitBranch, Globe, Lock, ShieldCheck } from "lucide-react";
import {
  Badge,
  Button,
  Field,
  FormModal,
  IdentifierText,
  Input,
  SWATCH_SURFACE_PALETTES,
  cn,
  type SwatchHue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  GOVERNANCE_SCOPE_TARGETS,
  POLICY_KINDS,
  WORKFLOW_KINDS,
  emptyDefinitionForm,
  type DefinitionFormValues,
  type GovernanceFamily,
} from "../governance-contract";

interface CreateDefinitionModalProps {
  family: GovernanceFamily;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: DefinitionFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

const KIND_HUES: Record<string, SwatchHue> = {
  CREDIT: "amber",
  PRICING_GUARD: "indigo",
  ORDER_CONFIRMATION: "green",
  PURCHASE_APPROVAL: "teal",
  INVENTORY_NEGATIVE: "red",
  INVENTORY_RESERVATION: "blue",
  INVENTORY_OVER_RECEIPT: "purple",
  PRICING_OVERRIDE: "indigo",
  CREDIT_CONTROL: "amber",
  DISCOUNT_GOVERNANCE: "purple",
  DOCUMENT_APPROVAL: "green",
  QUOTATION: "blue",
  SALES_ORDER: "indigo",
  PURCHASE_ORDER: "teal",
  PRICE_PUBLICATION: "purple",
  CONFIGURATION_PUBLICATION: "amber",
};

export function CreateDefinitionModal({
  family,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateDefinitionModalProps) {
  const { t } = useI18n();
  const initial = emptyDefinitionForm(family);
  const [values, setValues] = useState<DefinitionFormValues>(initial);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);
  const kinds: readonly string[] = family === "policy" ? POLICY_KINDS : WORKFLOW_KINDS;

  const activeHue = KIND_HUES[values.kind] ?? "indigo";
  const activePalette = SWATCH_SURFACE_PALETTES[activeHue];

  const getKindDescription = (kindCode: string): string => {
    switch (kindCode) {
      case "CREDIT":
        return t.tradeGovernance.kindDesc_CREDIT;
      case "PRICING_GUARD":
        return t.tradeGovernance.kindDesc_PRICING_GUARD;
      case "ORDER_CONFIRMATION":
        return t.tradeGovernance.kindDesc_ORDER_CONFIRMATION;
      case "PURCHASE_APPROVAL":
        return t.tradeGovernance.kindDesc_PURCHASE_APPROVAL;
      case "INVENTORY_NEGATIVE":
        return t.tradeGovernance.kindDesc_INVENTORY_NEGATIVE;
      case "INVENTORY_RESERVATION":
        return t.tradeGovernance.kindDesc_INVENTORY_RESERVATION;
      case "INVENTORY_OVER_RECEIPT":
        return t.tradeGovernance.kindDesc_INVENTORY_OVER_RECEIPT;
      case "PRICING_OVERRIDE":
        return t.tradeGovernance.kindDesc_PRICING_OVERRIDE;
      case "CREDIT_CONTROL":
        return t.tradeGovernance.kindDesc_CREDIT_CONTROL;
      case "DISCOUNT_GOVERNANCE":
        return t.tradeGovernance.kindDesc_DISCOUNT_GOVERNANCE;
      case "DOCUMENT_APPROVAL":
        return t.tradeGovernance.kindDesc_DOCUMENT_APPROVAL;
      case "QUOTATION":
        return t.tradeGovernance.kindDesc_QUOTATION;
      case "SALES_ORDER":
        return t.tradeGovernance.kindDesc_SALES_ORDER;
      case "PURCHASE_ORDER":
        return t.tradeGovernance.kindDesc_PURCHASE_ORDER;
      case "PRICE_PUBLICATION":
        return t.tradeGovernance.kindDesc_PRICE_PUBLICATION;
      case "CONFIGURATION_PUBLICATION":
        return t.tradeGovernance.kindDesc_CONFIGURATION_PUBLICATION;
      default:
        return t.tradeGovernance.definitionCreateDescription;
    }
  };

  return (
    <FormModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(initial);
          onClose();
        }
      }}
      size="wide"
      title={
        family === "policy"
          ? t.tradeGovernance.policyCreateTitle
          : t.tradeGovernance.workflowCreateTitle
      }
      description={t.tradeGovernance.definitionCreateDescription}
      headerIcon={
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border",
            activePalette.iconBoxIdle,
          )}
        >
          {family === "policy" ? (
            <ShieldCheck className="size-4" aria-hidden="true" />
          ) : (
            <GitBranch className="size-4" aria-hidden="true" />
          )}
        </div>
      }
      titleBadge={
        <Badge tone="brand">
          {tradeStatusLabel(t.tradeStatus, values.scopeTarget, t.common.unknownCode)}
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
            <p className="mt-1 text-xs text-muted-foreground">{getKindDescription(values.kind)}</p>
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{t.tradeGovernance.code}</span>
                <IdentifierText className="text-xs font-semibold text-foreground">
                  {values.code.trim().toUpperCase() ||
                    (family === "policy" ? "POL_DEFAULT_2026" : "WF_QUOTATION_STD")}
                </IdentifierText>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {family === "policy"
                    ? t.tradeGovernance.policyKind
                    : t.tradeGovernance.workflowKind}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
                    activePalette.badge,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", activePalette.dot)} />
                  {tradeStatusLabel(t.tradeStatus, values.kind, t.common.unknownCode)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {t.tradeGovernance.scopeTarget}
                </span>
                <IdentifierText className="text-xs font-semibold text-foreground">
                  {values.scopeTarget}
                </IdentifierText>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "flex items-start gap-2.5 rounded-lg border p-3 text-xs",
              SWATCH_SURFACE_PALETTES.amber.sectionCard,
            )}
          >
            <Lock
              className={cn("mt-0.5 size-4 shrink-0", SWATCH_SURFACE_PALETTES.amber.iconText)}
              aria-hidden="true"
            />
            <span className="text-foreground">{t.tradeGovernance.makerCheckerWarning}</span>
          </div>
        </div>
      }
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections:
          family === "policy"
            ? t.tradeGovernance.policyCreateTitle
            : t.tradeGovernance.workflowCreateTitle,
        sectionInvalid: t.tradeCommon.actionFailed,
      }}
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
            placeholder={family === "policy" ? "POL_MARGIN_FLOOR_KSA" : "WF_SALES_ORDER_KSA"}
            value={values.code}
            maxLength={100}
            disabled={isSubmitting}
            onChange={(event) =>
              setValues((current) => ({ ...current, code: event.target.value.toUpperCase() }))
            }
          />
        </Field>

        {/* Colorful Kind Archetype Selector Cards */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-foreground">
            {family === "policy" ? t.tradeGovernance.policyKind : t.tradeGovernance.workflowKind}
          </span>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {kinds.map((value) => {
              const hue = KIND_HUES[value] ?? "indigo";
              const palette = SWATCH_SURFACE_PALETTES[hue];
              const isSelected = values.kind === value;
              return (
                <Button
                  key={value}
                  type="button"
                  variant="ghost"
                  disabled={isSubmitting}
                  onClick={() => setValues((current) => ({ ...current, kind: value }))}
                  className={cn(
                    "h-auto flex-col items-start justify-start gap-1.5 rounded-lg border p-3 text-start whitespace-normal",
                    isSelected ? palette.tileActive : palette.tileIdle,
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode)}
                    </span>
                    <IdentifierText className="text-xs">{value}</IdentifierText>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {getKindDescription(value)}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Scope Target Selector Cards */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-foreground">
            {t.tradeGovernance.scopeTarget}
          </span>
          <div className="grid grid-cols-3 gap-2">
            {GOVERNANCE_SCOPE_TARGETS.map((scopeValue) => {
              const isSelected = values.scopeTarget === scopeValue;
              const palette =
                scopeValue === "TENANT"
                  ? SWATCH_SURFACE_PALETTES.purple
                  : scopeValue === "COMPANY"
                    ? SWATCH_SURFACE_PALETTES.indigo
                    : SWATCH_SURFACE_PALETTES.teal;
              return (
                <Button
                  key={scopeValue}
                  type="button"
                  variant="ghost"
                  disabled={isSubmitting}
                  onClick={() =>
                    setValues((current) => ({
                      ...current,
                      scopeTarget: scopeValue,
                    }))
                  }
                  className={cn(
                    "h-auto flex-col items-start justify-start gap-1 rounded-lg border p-2.5 text-start whitespace-normal",
                    isSelected ? palette.tileActive : palette.tileIdle,
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-1">
                    <Globe className="size-3.5" aria-hidden="true" />
                    <IdentifierText className="text-xs font-semibold">{scopeValue}</IdentifierText>
                  </div>
                  <span className="text-xs font-semibold text-foreground">
                    {tradeStatusLabel(t.tradeStatus, scopeValue, t.common.unknownCode)}
                  </span>
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t.tradeGovernance.scopeTargetHint}</p>
        </div>
      </div>
    </FormModal>
  );
}
