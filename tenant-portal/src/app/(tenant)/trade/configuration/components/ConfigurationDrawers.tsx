"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  Layers,
  Plus,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FormDrawer,
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
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import {
  CONFIGURATION_SCOPES,
  EMPTY_DEFINITION_FORM,
  EMPTY_VERSION_FORM,
  MERGE_STRATEGIES,
  RISK_CLASSES,
  isConfigurationScope,
  isMergeStrategy,
  isRiskClass,
  isVersionStatus,
  type ConfigurationDefinition,
  type ConfigurationScope,
  type DefinitionFormValues,
  type MergeStrategy,
  type RiskClass,
  type VersionFormValues,
} from "../configuration-contract";
import {
  CONFIG_UI_COPY,
  MERGE_STRATEGY_INFO,
  POLICY_STARTER_TEMPLATES,
  RISK_CLASS_PALETTES,
  VISUAL_SCHEMA_TYPES,
  buildSchemaJsonFromVisual,
  describeValueSchemaHumanReadable,
  formatPolicyValueHumanReadable,
  parseVisualArrayValue,
  parseVisualScalarValue,
  parseVisualSchema,
  validateMergeStrategyCompatibility,
} from "../configuration-catalogue-metadata";

const ARRAY_VALUE_PRESETS = ["EGP", "USD", "SAR", "EUR", "AED", "GBP"] as const;

function useDrawerLabels() {
  const { t } = useI18n();
  return {
    submit: t.trade.save,
    cancel: t.common.cancel,
    discardTitle: t.common.discardTitle,
    discardDescription: t.common.discardDescription,
    discardConfirm: t.common.discardConfirm,
    discardCancel: t.common.cancel,
  };
}

export function CreateDefinitionDrawer({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: DefinitionFormValues) => Promise<boolean>;
}) {
  const { t, lang } = useI18n();
  const copy = CONFIG_UI_COPY[lang];
  const labels = useDrawerLabels();
  const [values, setValues] = useState<DefinitionFormValues>(EMPTY_DEFINITION_FORM);
  const [showAdvancedSchema, setShowAdvancedSchema] = useState(false);

  const change = (patch: Partial<DefinitionFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  const visualConstraint = parseVisualSchema(values.valueSchema);
  const compatibility = validateMergeStrategyCompatibility(
    values.mergeStrategy,
    visualConstraint.type,
  );
  const mergeInfo = MERGE_STRATEGY_INFO[values.mergeStrategy];

  function updateVisualConstraint(patch: Partial<typeof visualConstraint>) {
    const next = { ...visualConstraint, ...patch };
    change({ valueSchema: buildSchemaJsonFromVisual(next) });
  }

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_DEFINITION_FORM);
          onClose();
        }
      }}
      title={t.trade.definitionCreateTitle}
      description={t.trade.definitionCreateDescription}
      isDirty={JSON.stringify(values) !== JSON.stringify(EMPTY_DEFINITION_FORM)}
      isSubmitting={isSubmitting}
      onSubmit={() => {
        void onSubmit(values).then((saved) => {
          if (saved) setValues(EMPTY_DEFINITION_FORM);
        });
      }}
      error={error ?? undefined}
      labels={labels}
    >
      <div className="flex flex-col gap-4">
        {/* Quick-Start Policy Templates */}
        <div className="rounded-lg border border-border bg-muted/25 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              {copy.quickStartTemplates}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POLICY_STARTER_TEMPLATES.map((tpl) => {
              const riskPalette = RISK_CLASS_PALETTES[tpl.riskClass];
              const isSelected = values.key === tpl.key;
              return (
                <Button
                  key={tpl.id}
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => {
                    const schemaJson = buildSchemaJsonFromVisual({
                      type: tpl.schemaType,
                      minimum: tpl.minimum ?? "",
                      maximum: tpl.maximum ?? "",
                      minLength: "",
                      maxLength: "",
                      enumValues: "",
                    });
                    change({
                      key: tpl.key,
                      allowedScopes: tpl.allowedScopes,
                      mergeStrategy: tpl.mergeStrategy,
                      riskClass: tpl.riskClass,
                      valueSchema: schemaJson,
                    });
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-medium",
                    isSelected && riskPalette.badgeClass,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", riskPalette.dotClass)} />
                  <span>{tpl.titles[lang]}</span>
                </Button>
              );
            })}
          </div>
        </div>

        <Field label={t.trade.definitionKey} hint={t.trade.definitionKeyHint} required>
          <Input
            size="sm"
            placeholder={t.trade.definitionKey}
            dir="ltr"
            className="font-mono"
            value={values.key}
            onChange={(event) => change({ key: event.target.value.toLowerCase() })}
            maxLength={120}
            disabled={isSubmitting}
            required
          />
        </Field>

        {/* Visual Value Constraint Builder */}
        <div className="rounded-lg border border-border bg-muted/20 p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <SlidersHorizontal className="size-3.5 text-primary" aria-hidden="true" />
              {copy.visualConstraintBuilder}
            </span>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setShowAdvancedSchema((prev) => !prev)}
            >
              {showAdvancedSchema ? copy.hideSchemaSource : copy.showSchemaSource}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {VISUAL_SCHEMA_TYPES.map((item) => {
              const selected = visualConstraint.type === item.type;
              return (
                <Button
                  key={item.type}
                  type="button"
                  size="xs"
                  variant={selected ? "primary" : "outline"}
                  disabled={isSubmitting}
                  onClick={() => updateVisualConstraint({ type: item.type })}
                  className="justify-between"
                >
                  <span>{item.labels[lang]}</span>
                  {selected && <CheckCircle2 className="size-3.5" aria-hidden="true" />}
                </Button>
              );
            })}
          </div>

          {(visualConstraint.type === "number" || visualConstraint.type === "integer") && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label={copy.minAllowedValue}>
                <Input
                  size="sm"
                  dir="ltr"
                  inputMode="decimal"
                  placeholder="0"
                  value={visualConstraint.minimum}
                  disabled={isSubmitting}
                  onChange={(e) => updateVisualConstraint({ minimum: e.target.value })}
                />
              </Field>
              <Field label={copy.maxAllowedValue}>
                <Input
                  size="sm"
                  dir="ltr"
                  inputMode="decimal"
                  placeholder="100"
                  value={visualConstraint.maximum}
                  disabled={isSubmitting}
                  onChange={(e) => updateVisualConstraint({ maximum: e.target.value })}
                />
              </Field>
            </div>
          )}

          {visualConstraint.type === "string" && (
            <div className="mt-3 flex flex-col gap-2">
              <Field label={copy.allowedOptionsHint}>
                <Input
                  size="sm"
                  dir="ltr"
                  placeholder="STRICT, STANDARD, RELAXED"
                  value={visualConstraint.enumValues}
                  disabled={isSubmitting}
                  onChange={(e) => updateVisualConstraint({ enumValues: e.target.value })}
                />
              </Field>
            </div>
          )}

          <div className={cn("mt-3", !showAdvancedSchema && "sr-only")}>
            <Field
              label={t.trade.definitionValueSchema}
              hint={t.trade.definitionValueSchemaHint}
              required
            >
              <Textarea
                placeholder={t.trade.definitionValueSchema}
                dir="ltr"
                className="font-mono text-xs"
                value={values.valueSchema}
                onChange={(event) => change({ valueSchema: event.target.value })}
                disabled={isSubmitting}
                required
              />
            </Field>
          </div>
        </div>

        {/* One to three of TENANT / COMPANY / BRANCH. A version whose scope is
            outside this set is a 422 TRADE.CONFIGURATION.SCOPE_FORBIDDEN. */}
        <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <legend className="px-1 text-xs font-semibold text-foreground">
            {t.trade.definitionAllowedScopes}
          </legend>
          <div className="flex flex-wrap gap-4">
            {CONFIGURATION_SCOPES.map((scope) => (
              <label key={scope} className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={values.allowedScopes.includes(scope)}
                  disabled={isSubmitting}
                  onCheckedChange={(checked) =>
                    change({
                      allowedScopes: checked
                        ? [...values.allowedScopes, scope]
                        : values.allowedScopes.filter((current) => current !== scope),
                    })
                  }
                />
                {t.trade[`scopeTarget_${scope}`]}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={t.trade.definitionMergeStrategy} required>
          <Select
            value={values.mergeStrategy}
            onValueChange={(next) => change({ mergeStrategy: next as MergeStrategy })}
            disabled={isSubmitting}
          >
            <SelectTrigger size="sm" aria-label={t.trade.definitionMergeStrategy}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MERGE_STRATEGIES.map((strategy) => (
                <SelectItem key={strategy} value={strategy}>
                  {t.trade[`mergeStrategy_${strategy}`]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">{mergeInfo.summaries[lang]}</p>
        </Field>

        {/* Merge Strategy Compatibility Guard */}
        {!compatibility.compatible && (
          <div
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs",
              SWATCH_SURFACE_PALETTES.amber.sectionCard,
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle
                className={cn("size-4 shrink-0", SWATCH_SURFACE_PALETTES.amber.iconText)}
                aria-hidden="true"
              />
              {compatibility.messages?.[lang]}
            </span>
            {mergeInfo.requiredValueTypes?.[0] && (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() =>
                  updateVisualConstraint({ type: mergeInfo.requiredValueTypes![0] })
                }
              >
                {copy.autoAlignType}
              </Button>
            )}
          </div>
        )}

        <Field label={t.trade.definitionRiskClass} required>
          <Select
            value={values.riskClass}
            onValueChange={(next) => change({ riskClass: next as RiskClass })}
            disabled={isSubmitting}
          >
            <SelectTrigger size="sm" aria-label={t.trade.definitionRiskClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RISK_CLASSES.map((risk) => (
                <SelectItem key={risk} value={risk}>
                  {t.trade[`riskClass_${risk}`]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Colorful Risk Class Visual Cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RISK_CLASSES.map((risk) => {
            const palette = RISK_CLASS_PALETTES[risk];
            const selected = values.riskClass === risk;
            return (
              <Button
                key={risk}
                type="button"
                size="xs"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => change({ riskClass: risk })}
                className={cn(
                  "justify-start gap-1.5 font-semibold",
                  selected && palette.badgeClass,
                )}
              >
                <span className={cn("size-2 rounded-full", palette.dotClass)} />
                <span>{t.trade[`riskClass_${risk}`]}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </FormDrawer>
  );
}

export function CreateVersionDrawer({
  definition,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  definition: ConfigurationDefinition;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: VersionFormValues) => Promise<boolean>;
}) {
  const { t, lang } = useI18n();
  const copy = CONFIG_UI_COPY[lang];
  const labels = useDrawerLabels();
  const [showRawValueSource, setShowRawValueSource] = useState(false);
  const [values, setValues] = useState<VersionFormValues>(() => {
    const firstScope = definition.allowedScopes[0];
    return {
      ...EMPTY_VERSION_FORM,
      scopeTarget:
        firstScope && isConfigurationScope(firstScope) ? firstScope : "COMPANY",
    };
  });
  const change = (patch: Partial<VersionFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));
  // Only the scopes the definition itself allows: anything else is a 422
  // TRADE.CONFIGURATION.SCOPE_FORBIDDEN.
  const scopes = CONFIGURATION_SCOPES.filter((scope) => definition.allowedScopes.includes(scope));
  const schemaType =
    typeof definition.valueSchema.type === "string" ? definition.valueSchema.type : "object";
  const enumOptions = Array.isArray(definition.valueSchema.enum)
    ? definition.valueSchema.enum.map(String)
    : [];
  const humanSchema = describeValueSchemaHumanReadable(definition.valueSchema, lang);
  const arraySelectedItems = parseVisualArrayValue(values.value);
  const scalarDisplay = parseVisualScalarValue(values.value);

  function toggleArrayPresetItem(item: string) {
    const next = arraySelectedItems.includes(item)
      ? arraySelectedItems.filter((x) => x !== item)
      : [...arraySelectedItems, item];
    change({ value: JSON.stringify(next) });
  }

  return (
    <FormDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.trade.versionCreateTitle}
      description={t.trade.versionCreateDescription}
      isDirty={JSON.stringify(values) !== JSON.stringify(EMPTY_VERSION_FORM)}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={labels}
    >
      <div className="flex flex-col gap-4">
        {/* Parent Policy Definition Context Banner */}
        <div className="rounded-lg border border-border bg-muted/25 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <IdentifierText className="font-semibold text-foreground">
              {definition.key}
            </IdentifierText>
            <Badge tone="neutral">{humanSchema}</Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            {t.trade.definitionMergeStrategy}:{" "}
            <strong>
              {isMergeStrategy(definition.mergeStrategy)
                ? t.trade[`mergeStrategy_${definition.mergeStrategy}`]
                : definition.mergeStrategy}
            </strong>
          </p>
        </div>

        <Field label={t.trade.versionScopeTarget} required>
          <Select
            value={values.scopeTarget}
            onValueChange={(next) => change({ scopeTarget: next as ConfigurationScope })}
            disabled={isSubmitting}
          >
            <SelectTrigger size="sm" aria-label={t.trade.versionScopeTarget}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scopes.map((scope) => (
                <SelectItem key={scope} value={scope}>
                  {t.trade[`scopeTarget_${scope}`]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Adaptive Visual Policy Value Input */}
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              {t.trade.versionValue} ({humanSchema})
            </span>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setShowRawValueSource((prev) => !prev)}
            >
              {showRawValueSource ? copy.hideValueSource : copy.showValueSource}
            </Button>
          </div>

          {schemaType === "boolean" && (
            <div className="grid grid-cols-2 gap-2">
              {(["true", "false"] as const).map((boolStr) => (
                <Button
                  key={boolStr}
                  type="button"
                  size="sm"
                  variant={values.value.trim() === boolStr ? "primary" : "outline"}
                  disabled={isSubmitting}
                  onClick={() => change({ value: boolStr })}
                  className="justify-between"
                >
                  <span>
                    {boolStr === "true" ? copy.boolEnabledTrue : copy.boolDisabledFalse}
                  </span>
                  <IdentifierText>{boolStr}</IdentifierText>
                </Button>
              ))}
            </div>
          )}

          {(schemaType === "number" || schemaType === "integer") && (
            <Input
              size="sm"
              dir="ltr"
              inputMode="decimal"
              placeholder="0"
              value={scalarDisplay}
              disabled={isSubmitting}
              onChange={(e) => change({ value: e.target.value })}
            />
          )}

          {schemaType === "string" && (
            <div className="flex flex-col gap-2">
              {enumOptions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {enumOptions.map((opt) => {
                    const selected = scalarDisplay === opt;
                    return (
                      <Button
                        key={opt}
                        type="button"
                        size="xs"
                        variant={selected ? "primary" : "outline"}
                        disabled={isSubmitting}
                        onClick={() => change({ value: JSON.stringify(opt) })}
                      >
                        {opt}
                      </Button>
                    );
                  })}
                </div>
              )}
              <Input
                size="sm"
                dir="ltr"
                placeholder={t.trade.versionValue}
                value={scalarDisplay}
                disabled={isSubmitting}
                onChange={(e) => change({ value: JSON.stringify(e.target.value) })}
              />
            </div>
          )}

          {schemaType === "array" && (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">
                {copy.arrayItemsPresetLabel}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ARRAY_VALUE_PRESETS.map((item) => {
                  const selected = arraySelectedItems.includes(item);
                  return (
                    <Button
                      key={item}
                      type="button"
                      size="xs"
                      variant={selected ? "primary" : "outline"}
                      disabled={isSubmitting}
                      onClick={() => toggleArrayPresetItem(item)}
                      className="font-mono text-xs"
                    >
                      {item}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className={cn(
              "mt-2",
              schemaType !== "object" && !showRawValueSource && "sr-only",
            )}
          >
            <Field label={t.trade.versionValue} hint={t.trade.versionValueHint} required>
              <Textarea
                placeholder={t.trade.versionValue}
                dir="ltr"
                className="font-mono"
                value={values.value}
                onChange={(event) => change({ value: event.target.value })}
                disabled={isSubmitting}
                required
              />
            </Field>
          </div>
        </div>

        <Field label={t.trade.versionEffectiveFrom} required>
          <Input
            size="sm"
            placeholder={t.trade.versionEffectiveFrom}
            dir="ltr"
            type="datetime-local"
            value={values.effectiveFrom}
            onChange={(event) => change({ effectiveFrom: event.target.value })}
            disabled={isSubmitting}
            required
          />
        </Field>

        <Field label={t.trade.versionEffectiveTo}>
          <Input
            size="sm"
            placeholder={t.trade.versionEffectiveTo}
            dir="ltr"
            type="datetime-local"
            value={values.effectiveTo}
            onChange={(event) => change({ effectiveTo: event.target.value })}
            disabled={isSubmitting}
          />
        </Field>
      </div>
    </FormDrawer>
  );
}

export function ConfigurationInspectModal({
  definition,
  canManage,
  onClose,
  onCreateVersion,
}: {
  definition: ConfigurationDefinition | null;
  canManage: boolean;
  onClose: () => void;
  onCreateVersion: (definition: ConfigurationDefinition) => void;
}) {
  const { t, lang } = useI18n();
  const copy = CONFIG_UI_COPY[lang];
  if (!definition) return null;

  const riskKey = isRiskClass(definition.riskClass) ? definition.riskClass : "MEDIUM";
  const riskPalette = RISK_CLASS_PALETTES[riskKey];
  const mergeKey = isMergeStrategy(definition.mergeStrategy)
    ? definition.mergeStrategy
    : "OVERRIDE";
  const mergeInfo = MERGE_STRATEGY_INFO[mergeKey];
  const humanSchema = describeValueSchemaHumanReadable(definition.valueSchema, lang);

  return (
    <Dialog
      open={definition !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="2xl" closeLabel={t.common.close}>
        <div
          className={cn("-mx-3.5 -mt-3.5 mb-2 h-2 rounded-t-lg", riskPalette.topAccentClass)}
        />
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
                riskPalette.badgeClass,
              )}
            >
              <span className={cn("size-1.5 rounded-full", riskPalette.dotClass)} />
              {isRiskClass(definition.riskClass)
                ? t.trade[`riskClass_${definition.riskClass}`]
                : definition.riskClass}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
                mergeInfo.badgeClass,
              )}
            >
              <GitMerge className="size-3" aria-hidden="true" />
              {isMergeStrategy(definition.mergeStrategy)
                ? t.trade[`mergeStrategy_${definition.mergeStrategy}`]
                : definition.mergeStrategy}
            </span>
            <Badge tone="neutral">{humanSchema}</Badge>
          </div>
          <DialogTitle className="mt-1">
            <IdentifierText className="text-sm font-semibold">{definition.key}</IdentifierText>
          </DialogTitle>
          <DialogDescription>{mergeInfo.labels[lang]}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/25 p-3.5 sm:grid-cols-2">
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {t.trade.definitionAllowedScopes}
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {definition.allowedScopes.map((scope) => (
                <Badge key={scope} tone="neutral">
                  {isConfigurationScope(scope) ? t.trade[`scopeTarget_${scope}`] : scope}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {copy.valueConstraintType}
            </span>
            <p className="mt-1 text-xs font-semibold text-foreground">{humanSchema}</p>
          </div>
        </div>

        {/* Versions Summary List */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Layers className="size-3.5 text-primary" aria-hidden="true" />
              {t.trade.versionsTitle} ({definition.versions.length})
            </span>
          </div>
          {definition.versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.trade.versionEmpty}</p>
          ) : (
            <ul className="flex max-h-44 flex-col gap-1.5 overflow-y-auto">
              {definition.versions.map((ver) => (
                <li
                  key={ver.id}
                  className="flex items-center justify-between gap-2 rounded border border-border/70 bg-muted/20 px-2.5 py-1.5 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <IdentifierText className="font-semibold">
                      v{ver.versionNumber}
                    </IdentifierText>
                    <Badge tone="neutral">
                      {isConfigurationScope(ver.scopeTarget)
                        ? t.trade[`scopeTarget_${ver.scopeTarget}`]
                        : ver.scopeTarget}
                    </Badge>
                    <span dir="ltr" className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
                      {formatPolicyValueHumanReadable(ver.value, lang)}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDateTime(ver.effectiveFrom, lang)}
                    </span>
                  </div>
                  <Badge tone={ver.status === "PUBLISHED" ? "positive" : "neutral"}>
                    {isVersionStatus(ver.status)
                      ? t.trade[`versionStatus_${ver.status}`]
                      : ver.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t.common.close}
          </Button>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                onCreateVersion(definition);
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {t.trade.versionCreate}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
