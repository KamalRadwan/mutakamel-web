"use client";

import { useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  Globe,
  Layers,
  Lock,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  Badge,
  Button,
  cn,
  Field,
  IdentifierText,
  Input,
  SWATCH_SURFACE_PALETTES,
  ToggleGroup,
  ToggleGroupItem,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  EXPORT_LOCALE_OPTIONS,
  getUomCatalogueMetadata,
  QUICK_PACKAGING_PRESETS,
  STARTER_UOM_LIBRARY,
  suggestAlternativeUomCodes,
  suggestValidUomCodes,
  UOM_CATEGORIES,
  UOM_CATEGORY_HUES,
  type StarterUomDefinition,
  type UomCategory,
} from "../uom-catalogue-metadata";
import {
  UOM_CODE_MAX_LENGTH,
  UOM_DISPLAY_NAME_MAX_LENGTH,
  validateUomForm,
  type Uom,
  type UomFormIssues,
  type UomFormValues,
  type UomStatus,
} from "../uom-contract";

export type UomFieldErrors = Partial<Record<keyof UomFormIssues, string>>;

export type UomCreateEntryMode = "custom" | "library";

interface UomFormFieldsProps {
  values: UomFormValues;
  errors?: UomFieldErrors;
  onChange: (patch: Partial<UomFormValues>, clear?: keyof UomFormIssues) => void;
  onBlur?: (field: keyof UomFormIssues) => void;
  isSubmitting: boolean;
  /** `CreateUomDto` has a code; `UpdateUomDto` does not — it cannot be changed. */
  codeReadOnly: boolean;
  showStatus: boolean;
  entryMode?: UomCreateEntryMode;
  onEntryModeChange?: (mode: UomCreateEntryMode) => void;
  existingCodes?: ReadonlySet<string>;
  isCodeTaken?: boolean;
  onInspectExistingCode?: (code: string) => void;
}

const INPUT_SURFACE =
  "border-input read-only:bg-muted read-only:border-border dark:border-input dark:read-only:bg-muted";

export function UomFormFields({
  values,
  errors,
  onChange,
  onBlur,
  isSubmitting,
  codeReadOnly,
  showStatus,
  entryMode = "custom",
  onEntryModeChange,
  existingCodes,
  isCodeTaken = false,
  onInspectExistingCode,
}: UomFormFieldsProps) {
  const { t } = useI18n();
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryCategory, setLibraryCategory] = useState<UomCategory | "ALL">("ALL");

  const extraLocales = values.extraLocales ?? {};
  const extraLocaleEntries = Object.entries(extraLocales);
  const filledExtraCount = extraLocaleEntries.filter(([, text]) => text.trim().length > 0).length;
  const filledLocales =
    (values.nameEn.trim().length > 0 ? 1 : 0) +
    (values.nameAr.trim().length > 0 ? 1 : 0) +
    filledExtraCount;

  const metadata = getUomCatalogueMetadata(values.code, values.displayName, {
    ar: values.nameAr,
    en: values.nameEn,
  });
  const categoryPalette = SWATCH_SURFACE_PALETTES[metadata.hue];
  const categoryLabel = t.trade[`uomCategory_${metadata.category}`];

  const autoFixCodes =
    !codeReadOnly && errors?.code
      ? suggestValidUomCodes(values.code, values.displayName)
      : [];

  const duplicateSuggestions =
    !codeReadOnly && isCodeTaken
      ? suggestAlternativeUomCodes(values.code, existingCodes)
      : [];

  const applyStarterItem = (item: StarterUomDefinition) => {
    onChange(
      {
        code: item.code,
        displayName: item.nameEn,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
      },
      "code",
    );
    onEntryModeChange?.("custom");
  };

  const handleAddExtraLocale = (localeCode: string) => {
    if (localeCode in extraLocales || extraLocaleEntries.length >= 18) return;
    onChange(
      {
        extraLocales: {
          ...extraLocales,
          [localeCode]: "",
        },
      },
      "localizedNames",
    );
  };

  const handleUpdateExtraLocale = (localeCode: string, text: string) => {
    onChange(
      {
        extraLocales: {
          ...extraLocales,
          [localeCode]: text,
        },
      },
      "localizedNames",
    );
  };

  const handleRemoveExtraLocale = (localeCode: string) => {
    const next = { ...extraLocales };
    delete next[localeCode];
    onChange({ extraLocales: next }, "localizedNames");
  };

  const filteredLibrary = STARTER_UOM_LIBRARY.filter((item) => {
    if (libraryCategory !== "ALL" && item.category !== libraryCategory) {
      return false;
    }
    const query = librarySearch.trim().toLowerCase();
    if (!query) return true;
    return (
      item.code.toLowerCase().includes(query) ||
      item.nameEn.toLowerCase().includes(query) ||
      item.nameAr.toLowerCase().includes(query) ||
      (item.unEceCode?.toLowerCase().includes(query) ?? false)
    );
  });

  return (
    <div className="grid gap-3.5">
      {/* Mode Switcher on Create: Custom Unit vs 119 Standard Units Library */}
      {!codeReadOnly && onEntryModeChange ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-2 shadow-2xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={entryMode === "custom" ? "primary" : "ghost"}
              onClick={() => onEntryModeChange("custom")}
              className="gap-1.5"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              {t.trade.uomModeCustom}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={entryMode === "library" ? "primary" : "ghost"}
              onClick={() => onEntryModeChange("library")}
              className="gap-1.5"
            >
              <BookOpen className="size-3.5" aria-hidden="true" />
              {t.trade.uomModeLibrary}
            </Button>
          </div>
          <Badge tone="neutral" className={cn("gap-1.5 rounded-full px-2.5 py-0.5 text-xs", categoryPalette.badge)}>
            <span className={cn("size-1.5 rounded-full", categoryPalette.dot)} aria-hidden="true" />
            {categoryLabel}
          </Badge>
        </div>
      ) : null}

      {/* Standard Library Picker View */}
      {!codeReadOnly && entryMode === "library" ? (
        <div className="grid gap-3.5 rounded-lg border border-border bg-card p-4 shadow-2xs">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">
                {t.trade.uomModeLibrary}
              </span>
              <Badge tone="brand" className="rounded-full px-2.5 py-0.5 text-xs">
                <IdentifierText>119</IdentifierText>
                <span className="ms-1">{t.trade.uomUnEceCode}</span>
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.trade.uomLibrarySelectHint}
            </p>
          </div>

          <div className="relative flex items-center">
            <Search
              className="pointer-events-none absolute start-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              size="md"
              value={librarySearch}
              onChange={(event) => setLibrarySearch(event.target.value)}
              placeholder={t.trade.uomLibrarySearchPlaceholder}
              className={cn("ps-9", INPUT_SURFACE)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="xs"
              variant={libraryCategory === "ALL" ? "primary" : "outline"}
              onClick={() => setLibraryCategory("ALL")}
              className="rounded-full"
            >
              {t.trade.uomCategoriesAll}
            </Button>
            {UOM_CATEGORIES.map((category) => {
              const hue = UOM_CATEGORY_HUES[category];
              const palette = SWATCH_SURFACE_PALETTES[hue];
              const isSelected = libraryCategory === category;
              return (
                <Button
                  key={category}
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setLibraryCategory(category)}
                  className={cn(
                    "gap-1.5 rounded-full",
                    isSelected ? palette.pillActive : "bg-card text-muted-foreground",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", palette.dot)} aria-hidden="true" />
                  {t.trade[`uomCategory_${category}`]}
                </Button>
              );
            })}
          </div>

          <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto pe-1 sm:grid-cols-2">
            {filteredLibrary.map((item) => {
              const hue = UOM_CATEGORY_HUES[item.category];
              const palette = SWATCH_SURFACE_PALETTES[hue];
              const alreadyAdded = existingCodes?.has(item.code) ?? false;
              const isCurrentCode = values.code.trim().toUpperCase() === item.code;
              return (
                <div
                  key={item.code}
                  className={cn(
                    "flex items-center justify-between gap-2.5 rounded-lg border p-2.5 transition-colors",
                    isCurrentCode ? palette.tileActive : palette.tileIdle,
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <IdentifierText className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
                        {item.code}
                      </IdentifierText>
                      {item.unEceCode ? (
                        <IdentifierText className="text-2xs text-muted-foreground">
                          UN:{item.unEceCode}
                        </IdentifierText>
                      ) : null}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium",
                          palette.badge,
                        )}
                      >
                        {t.trade[`uomCategory_${item.category}`]}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-medium text-foreground">{item.nameEn}</span>
                      <span className="text-muted-foreground" aria-hidden="true">
                        ·
                      </span>
                      <span dir="rtl" className="font-medium text-muted-foreground">
                        {item.nameAr}
                      </span>
                    </div>
                  </div>

                  {alreadyAdded ? (
                    <Badge tone="neutral" className="shrink-0 rounded-full px-2 py-0.5 text-2xs">
                      {t.trade.uomLibraryAlreadyAdded}
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => applyStarterItem(item)}
                      className="shrink-0"
                    >
                      {t.trade.uomLibraryUseTemplate}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 1. Identity Card */}
      <fieldset className="grid gap-3.5 rounded-lg border border-border bg-card p-4 shadow-2xs">
        <legend className="sr-only">{t.trade.uomIdentityTitle}</legend>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {t.trade.uomIdentityTitle}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                categoryPalette.badge,
              )}
            >
              <span className={cn("size-1.5 rounded-full", categoryPalette.dot)} aria-hidden="true" />
              {categoryLabel}
            </span>
            {metadata.unEceCode ? (
              <Badge tone="neutral" className="rounded-full px-2 py-0.5 text-2xs">
                <IdentifierText>UN/ECE {metadata.unEceCode}</IdentifierText>
              </Badge>
            ) : null}
          </div>

          {codeReadOnly ? (
            <Badge
              tone="neutral"
              className="gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground normal-case tracking-normal"
            >
              <Lock className="size-3 text-muted-foreground" aria-hidden="true" />
              {t.trade.uomCodeLocked}
            </Badge>
          ) : (
            <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
              <span>{t.trade.uomPreviewLabel}:</span>
              <IdentifierText className="font-semibold text-foreground">
                {values.code.trim() || "—"}
              </IdentifierText>
              <span aria-hidden="true">·</span>
              <span className="truncate font-medium text-foreground">
                {values.displayName.trim() || "—"}
              </span>
            </div>
          )}
        </div>

        <div className="grid items-start gap-3.5 sm:grid-cols-2">
          <Field
            label={t.trade.uomCode}
            hint={codeReadOnly ? undefined : t.trade.uomCodeHint}
            hintPlacement="tooltip"
            error={errors?.code}
            readOnly={codeReadOnly}
            required={!codeReadOnly}
            showLabel
          >
            <div className="relative flex items-center">
              <Input
                size="md"
                dir="ltr"
                placeholder=""
                className={cn("pe-12 font-mono", INPUT_SURFACE)}
                value={values.code}
                onChange={(event) =>
                  onChange({ code: event.target.value.toUpperCase() }, "code")
                }
                onBlur={() => onBlur?.("code")}
                maxLength={UOM_CODE_MAX_LENGTH}
                disabled={isSubmitting}
                readOnly={codeReadOnly}
                required={!codeReadOnly}
                autoFocus={!codeReadOnly}
              />
              {codeReadOnly ? (
                <Lock
                  className="pointer-events-none absolute end-3 size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : (
                <span
                  dir="ltr"
                  className="pointer-events-none absolute end-3 font-mono text-xs tabular-nums text-muted-foreground"
                  aria-hidden="true"
                >
                  {values.code.length}/{UOM_CODE_MAX_LENGTH}
                </span>
              )}
            </div>
          </Field>

          <Field
            label={t.trade.uomDisplayName}
            error={errors?.displayName}
            required
            showLabel
          >
            <Input
              size="md"
              placeholder=""
              className={INPUT_SURFACE}
              value={values.displayName}
              onChange={(event) =>
                onChange({ displayName: event.target.value }, "displayName")
              }
              onBlur={() => onBlur?.("displayName")}
              maxLength={UOM_DISPLAY_NAME_MAX_LENGTH}
              disabled={isSubmitting}
              required
              autoFocus={codeReadOnly}
            />
          </Field>
        </div>

        {/* Smart One-Click Auto-Fix Suggestions when Code Syntax is Invalid */}
        {autoFixCodes.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning-subtle/60 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-warning-subtle-foreground">
              <Wand2 className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{t.trade.uomAutoFixTitle}:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {autoFixCodes.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => onChange({ code: suggestion }, "code")}
                  className="gap-1 bg-card"
                >
                  <IdentifierText className="font-semibold">{suggestion}</IdentifierText>
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Duplicate Code (409) Resolution Assistant */}
        {duplicateSuggestions.length > 0 ? (
          <div className="grid gap-2 rounded-md border border-warning/30 bg-warning-subtle/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-warning-subtle-foreground">
                  {t.trade.uomDuplicateAssistantTitle}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.trade.uomDuplicateAssistantDescription}
                </span>
              </div>
              {onInspectExistingCode && values.code.trim() ? (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => onInspectExistingCode(values.code.trim().toUpperCase())}
                  className="bg-card"
                >
                  {t.trade.uomDuplicateViewExisting}
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {duplicateSuggestions.map((altCode) => (
                <Button
                  key={altCode}
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => onChange({ code: altCode }, "code")}
                  className="gap-1 bg-card"
                >
                  <IdentifierText className="font-semibold">{altCode}</IdentifierText>
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </fieldset>

      {/* 2. Localized Names & Multi-Language Export Builder Card */}
      <fieldset className="grid gap-3.5 rounded-lg border border-border bg-card p-4 shadow-2xs">
        <legend className="sr-only">
          {t.trade.localizedNamesTitle} · {t.trade.localizedNamesRequirement}
        </legend>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground">
              {t.trade.localizedNamesTitle}
            </span>
            <span className="text-sm font-semibold text-foreground" aria-hidden="true">
              ·
            </span>
            <span className="text-sm font-semibold text-foreground">
              {t.trade.localizedNamesRequirement}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge
              tone={filledLocales > 0 ? "positive" : "neutral"}
              className="gap-1.5 rounded-full px-3 py-1 text-xs font-medium normal-case tracking-normal"
            >
              {filledLocales > 0 ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : null}
              {formatTemplate(t.trade.uomLocalesCapacity, { count: filledLocales })}
            </Badge>
          </div>
        </div>

        <div className="grid items-start gap-3.5 sm:grid-cols-2">
          <div className="relative">
            <IdentifierText
              aria-hidden="true"
              className="pointer-events-none absolute -top-0.5 end-0 rounded-sm border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              EN · LTR
            </IdentifierText>
            <Field
              label={t.trade.nameEn}
              error={errors?.localizedNames}
              showLabel
            >
              <Input
                size="md"
                dir="ltr"
                placeholder=""
                className={INPUT_SURFACE}
                value={values.nameEn}
                onChange={(event) =>
                  onChange({ nameEn: event.target.value }, "localizedNames")
                }
                onBlur={() => onBlur?.("localizedNames")}
                maxLength={UOM_DISPLAY_NAME_MAX_LENGTH}
                disabled={isSubmitting}
              />
            </Field>
          </div>

          <div className="relative">
            <IdentifierText
              aria-hidden="true"
              className="pointer-events-none absolute -top-0.5 end-0 rounded-sm border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              AR · RTL
            </IdentifierText>
            <Field
              label={t.trade.nameAr}
              showLabel
            >
              <Input
                size="md"
                dir="rtl"
                placeholder=""
                className={INPUT_SURFACE}
                value={values.nameAr}
                onChange={(event) =>
                  onChange({ nameAr: event.target.value }, "localizedNames")
                }
                onBlur={() => onBlur?.("localizedNames")}
                maxLength={UOM_DISPLAY_NAME_MAX_LENGTH}
                disabled={isSubmitting}
              />
            </Field>
          </div>
        </div>

        {/* Additional Export & Import Languages Builder */}
        <div className="grid gap-2.5 border-t border-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Globe className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">
                {t.trade.uomExtraLocalesTitle}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {t.trade.uomExtraLocalesHint}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {EXPORT_LOCALE_OPTIONS.map((option) => {
              const isAdded = option.code in extraLocales;
              return (
                <Button
                  key={option.code}
                  type="button"
                  size="xs"
                  variant={isAdded ? "secondary" : "outline"}
                  disabled={isSubmitting || isAdded || extraLocaleEntries.length >= 18}
                  onClick={() => handleAddExtraLocale(option.code)}
                  className="gap-1 rounded-full"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  <IdentifierText>{option.code}</IdentifierText>
                </Button>
              );
            })}
          </div>

          {extraLocaleEntries.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {extraLocaleEntries.map(([localeCode, localeText]) => {
                const knownOption = EXPORT_LOCALE_OPTIONS.find(
                  (opt) => opt.code === localeCode,
                );
                const labelText = knownOption
                  ? t.trade[knownOption.labelKey]
                  : localeCode;
                return (
                  <div
                    key={localeCode}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/35 p-2"
                  >
                    <IdentifierText className="shrink-0 rounded-sm border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground">
                      {localeCode}
                    </IdentifierText>
                    <Input
                      size="sm"
                      dir="ltr"
                      aria-label={labelText}
                      placeholder={t.trade.uomExtraLocaleValuePlaceholder}
                      value={localeText}
                      onChange={(event) =>
                        handleUpdateExtraLocale(localeCode, event.target.value)
                      }
                      maxLength={UOM_DISPLAY_NAME_MAX_LENGTH}
                      disabled={isSubmitting}
                      className="flex-1 bg-card"
                    />
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      aria-label={`${t.trade.uomExtraLocaleRemove} ${localeCode}`}
                      onClick={() => handleRemoveExtraLocale(localeCode)}
                      disabled={isSubmitting}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </fieldset>

      {/* 3. Status Card (Edit Mode Only) */}
      {showStatus ? (
        <fieldset className="grid gap-3.5 rounded-lg border border-border bg-card p-4 shadow-2xs">
          <legend className="sr-only">{t.common.status}</legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">
              {t.common.status}
            </span>
            <span className="text-xs text-muted-foreground">
              {t.trade.uomStatusHint}
            </span>
          </div>

          <ToggleGroup
            type="single"
            value={values.status}
            onValueChange={(next) => {
              if (next) onChange({ status: next as UomStatus });
            }}
            size="md"
            disabled={isSubmitting}
            aria-label={t.common.status}
            className="grid w-full grid-cols-1 gap-3 bg-transparent p-0 sm:grid-cols-2"
          >
            <ToggleGroupItem
              value="ACTIVE"
              className={cn(
                "h-auto items-start justify-start gap-2.5 rounded-lg border border-border bg-card px-3.5 py-3 text-start whitespace-normal",
                "data-[state=on]:border-primary data-[state=on]:bg-info-subtle/40 data-[state=on]:text-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  values.status === "ACTIVE"
                    ? "border-primary bg-primary"
                    : "border-border bg-card",
                )}
              >
                {values.status === "ACTIVE" ? (
                  <span className="size-1.5 rounded-full bg-primary-foreground" />
                ) : null}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <span
                    className="size-2 rounded-full bg-success-vivid"
                    aria-hidden="true"
                  />
                  {t.trade.uomStatus_ACTIVE}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {t.trade.uomStatusActiveDescription}
                </span>
              </span>
            </ToggleGroupItem>

            <ToggleGroupItem
              value="RETIRED"
              className={cn(
                "h-auto items-start justify-start gap-2.5 rounded-lg border border-border bg-card px-3.5 py-3 text-start whitespace-normal",
                "data-[state=on]:border-primary data-[state=on]:bg-info-subtle/40 data-[state=on]:text-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  values.status === "RETIRED"
                    ? "border-primary bg-primary"
                    : "border-border bg-card",
                )}
              >
                {values.status === "RETIRED" ? (
                  <span className="size-1.5 rounded-full bg-primary-foreground" />
                ) : null}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  {t.trade.uomStatus_RETIRED}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {t.trade.uomStatusRetiredDescription}
                </span>
              </span>
            </ToggleGroupItem>
          </ToggleGroup>
        </fieldset>
      ) : null}
    </div>
  );
}

interface UomWorkbenchAsideProps {
  values: UomFormValues;
  codeReadOnly: boolean;
  uom?: Uom;
  onSelectPreset?: (patch: Partial<UomFormValues>) => void;
}

export function UomWorkbenchAside({
  values,
  codeReadOnly,
  uom,
  onSelectPreset,
}: UomWorkbenchAsideProps) {
  const { t } = useI18n();
  const metadata = getUomCatalogueMetadata(values.code, values.displayName, {
    ar: values.nameAr,
    en: values.nameEn,
  });
  const palette = SWATCH_SURFACE_PALETTES[metadata.hue];
  const categoryLabel = t.trade[`uomCategory_${metadata.category}`];

  const issues = validateUomForm(values, {
    codeReadOnly,
    currentNames: uom?.localizedNames,
  });
  const codeReady = codeReadOnly || (!issues.code && values.code.trim().length > 0);
  const displayNameReady = !issues.displayName && values.displayName.trim().length > 0;
  const namesReady = !issues.localizedNames;

  const extraLocales = values.extraLocales ?? {};
  const filledExtraLocales = Object.entries(extraLocales).filter(
    ([, val]) => val.trim().length > 0,
  );

  const previewCode = values.code.trim().toUpperCase() || "CODE";
  const previewDisplay = values.displayName.trim() || t.trade.uomDisplayName;

  const diffRows: Array<{ label: string; before: string; after: string }> = [];
  if (codeReadOnly && uom) {
    if (values.displayName.trim() !== uom.displayName) {
      diffRows.push({
        label: t.trade.uomDisplayName,
        before: uom.displayName,
        after: values.displayName.trim() || "—",
      });
    }
    if (values.nameEn.trim() !== (uom.localizedNames.en ?? "")) {
      diffRows.push({
        label: t.trade.nameEn,
        before: uom.localizedNames.en ?? "—",
        after: values.nameEn.trim() || "—",
      });
    }
    if (values.nameAr.trim() !== (uom.localizedNames.ar ?? "")) {
      diffRows.push({
        label: t.trade.nameAr,
        before: uom.localizedNames.ar ?? "—",
        after: values.nameAr.trim() || "—",
      });
    }
    if (values.status !== uom.status) {
      diffRows.push({
        label: t.common.status,
        before: t.trade[`uomStatus_${uom.status}`],
        after: t.trade[`uomStatus_${values.status}`],
      });
    }
  }

  return (
    <div className="flex flex-col gap-3.5 p-4">
      {/* 1. Colorful Live Unit Preview Card */}
      <div
        className={cn(
          "grid gap-3 rounded-lg border border-s-4 p-3.5 shadow-2xs",
          palette.sectionCard,
          palette.accentBorder,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">
            {t.trade.uomLivePreviewTitle}
          </span>
          <Badge
            tone={values.status === "ACTIVE" ? "positive" : "neutral"}
            className="rounded-full px-2 py-0.5 text-2xs"
          >
            {t.trade[`uomStatus_${values.status}`]}
          </Badge>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border bg-card p-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold",
              palette.iconBoxIdle,
            )}
          >
            <IdentifierText>{previewCode.slice(0, 4)}</IdentifierText>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <IdentifierText className="text-sm font-semibold text-foreground">
                {previewCode}
              </IdentifierText>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium",
                  palette.badge,
                )}
              >
                {categoryLabel}
              </span>
            </div>
            <span className="truncate text-xs font-medium text-foreground">
              {previewDisplay}
            </span>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {values.nameEn.trim() ? (
                <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted px-1.5 py-0.5 text-2xs text-foreground">
                  <IdentifierText className="text-muted-foreground">EN</IdentifierText>
                  <span className="max-w-28 truncate">{values.nameEn.trim()}</span>
                </span>
              ) : null}
              {values.nameAr.trim() ? (
                <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted px-1.5 py-0.5 text-2xs text-foreground">
                  <IdentifierText className="text-muted-foreground">AR</IdentifierText>
                  <span dir="rtl" className="max-w-28 truncate">
                    {values.nameAr.trim()}
                  </span>
                </span>
              ) : null}
              {filledExtraLocales.map(([loc]) => (
                <IdentifierText
                  key={loc}
                  className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-2xs font-medium text-foreground"
                >
                  {loc.toUpperCase()}
                </IdentifierText>
              ))}
            </div>
          </div>
        </div>

        {/* Sample Invoice Line Preview */}
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-card/80 px-2.5 py-2 text-xs">
          <span className="text-muted-foreground">{t.trade.uomInvoiceSampleLabel}</span>
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <span dir="ltr" className="tabular-nums text-muted-foreground">
              {t.trade.uomInvoiceSampleQty}
            </span>
            <IdentifierText className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-semibold">
              {previewCode}
            </IdentifierText>
            <span className="max-w-28 truncate text-xs">({previewDisplay})</span>
          </div>
        </div>
      </div>

      {/* 2. Setup Readiness Checklist */}
      <div className="grid gap-2 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
        <span className="text-xs font-semibold text-foreground">
          {t.trade.uomReadinessTitle}
        </span>
        <ul className="grid gap-1.5 text-xs">
          <li className="flex items-center gap-2">
            <CheckCircle2
              className={cn(
                "size-4 shrink-0",
                codeReady ? "text-success-subtle-foreground" : "text-muted-foreground/50",
              )}
              aria-hidden="true"
            />
            <span className={codeReady ? "text-foreground" : "text-muted-foreground"}>
              {t.trade.uomReadinessCode}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2
              className={cn(
                "size-4 shrink-0",
                displayNameReady
                  ? "text-success-subtle-foreground"
                  : "text-muted-foreground/50",
              )}
              aria-hidden="true"
            />
            <span
              className={displayNameReady ? "text-foreground" : "text-muted-foreground"}
            >
              {t.trade.uomReadinessDisplayName}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2
              className={cn(
                "size-4 shrink-0",
                namesReady
                  ? "text-success-subtle-foreground"
                  : "text-muted-foreground/50",
              )}
              aria-hidden="true"
            />
            <span className={namesReady ? "text-foreground" : "text-muted-foreground"}>
              {t.trade.uomReadinessBilingual}
            </span>
          </li>
        </ul>
      </div>

      {/* 3. Create Mode: Quick Commercial Packaging Presets */}
      {!codeReadOnly && onSelectPreset ? (
        <div className="grid gap-2 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5">
            <Layers className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-semibold text-foreground">
              {t.trade.uomQuickPresetsTitle}
            </span>
          </div>
          <p className="text-2xs text-muted-foreground">
            {t.trade.uomQuickPresetsHint}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {QUICK_PACKAGING_PRESETS.map((preset) => (
              <Button
                key={preset.code}
                type="button"
                size="xs"
                variant="outline"
                onClick={() =>
                  onSelectPreset({
                    code: preset.code,
                    displayName: preset.displayName,
                    nameAr: preset.nameAr,
                    nameEn: preset.nameEn,
                  })
                }
                className="gap-1 bg-muted/35"
              >
                <IdentifierText className="font-semibold">{preset.code}</IdentifierText>
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {/* 4. Edit Mode: Revision & Pending Diff Summary */}
      {codeReadOnly && uom ? (
        <div className="grid gap-2.5 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              {t.trade.uomEditDiffTitle}
            </span>
            <Badge tone="brand" className="rounded-full px-2 py-0.5 text-2xs">
              <IdentifierText>If-Match: v{uom.version}</IdentifierText>
            </Badge>
          </div>

          <p className="text-2xs text-muted-foreground">
            {t.trade.uomEditCodeImmutableNotice}
          </p>

          {diffRows.length === 0 ? (
            <div className="rounded-md border border-border bg-muted/35 px-2.5 py-2 text-xs text-muted-foreground">
              {t.trade.uomEditDiffNoChanges}
            </div>
          ) : (
            <div className="grid gap-1.5">
              {diffRows.map((row) => (
                <div
                  key={row.label}
                  className="grid gap-1 rounded-md border border-border bg-muted/35 p-2 text-xs"
                >
                  <span className="font-semibold text-foreground">{row.label}</span>
                  <div className="flex flex-wrap items-center gap-1.5 text-2xs">
                    <span className="rounded-sm bg-card px-1.5 py-0.5 text-muted-foreground line-through">
                      {row.before}
                    </span>
                    <span aria-hidden="true">→</span>
                    <span className="rounded-sm bg-success-subtle px-1.5 py-0.5 font-medium text-success-subtle-foreground">
                      {row.after}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
