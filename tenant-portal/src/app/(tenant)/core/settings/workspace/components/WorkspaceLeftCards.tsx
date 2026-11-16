"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Combobox,
  Field,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  cn,
  useFieldControl,
  type ComboboxOption,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { useDirection, type Language } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "@/lib/format/locale";
import { formatTemplate } from "@/lib/format/template";
import type { WorkspaceFieldName } from "../hooks/useWorkspaceSettings";
import {
  TIMEZONE_MAX_LENGTH,
  WORKSPACE_LANGUAGES,
  formatTimezoneLiveClock,
  type WorkspaceSettingsDraft,
} from "../workspace-settings-contract";

interface WorkspaceRegionalSectionProps {
  t: Dictionary;
  lang: Language;
  draft: WorkspaceSettingsDraft;
  isReadOnly: boolean;
  isSaving: boolean;
  fieldError: { field: WorkspaceFieldName; message: string } | null;
  timezones: { hasZones: boolean; options: ComboboxOption[]; onSearch: (query: string) => void };
  onUpdateDraft: (patch: Partial<WorkspaceSettingsDraft>) => void;
}

export function WorkspaceRegionalSection({
  t,
  lang,
  draft,
  isReadOnly,
  isSaving,
  fieldError,
  timezones,
  onUpdateDraft,
}: WorkspaceRegionalSectionProps) {
  const wsUi = t.coreSettings.workspaceUi;
  const locale = INTL_LOCALE[lang];
  const [liveClock, setLiveClock] = useState<string | null>(() =>
    formatTimezoneLiveClock(draft.timezone, locale),
  );

  useEffect(() => {
    const updateClock = () => setLiveClock(formatTimezoneLiveClock(draft.timezone, locale));
    updateClock();
    const timer = window.setInterval(updateClock, 10_000);
    return () => window.clearInterval(timer);
  }, [draft.timezone, locale]);

  const hasRegionalError =
    fieldError?.field === "defaultLanguage" || fieldError?.field === "timezone";

  return (
    <Card className={cn(hasRegionalError && "border-destructive/50")}>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-card-title">{t.coreSettings.workspaceRegionalTitle}</CardTitle>
        {liveClock ? (
          <Badge tone="neutral" size="sm" className="tabular-nums">
            <Clock className="size-3" aria-hidden="true" />
            <span>{formatTemplate(wsUi.liveLocalTime, { time: liveClock })}</span>
          </Badge>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Field
          showLabel
          label={t.coreSettings.workspaceLanguage}
          hint={t.coreSettings.workspaceLanguageHint}
          error={fieldError?.field === "defaultLanguage" ? fieldError.message : undefined}
          readOnly={isReadOnly}
        >
          <LanguageRadioGroup
            value={draft.defaultLanguage}
            disabled={isReadOnly || isSaving}
            groupLabel={t.coreSettings.workspaceLanguage}
            labels={t.coreSettings.languageNames}
            onSelect={(value) => onUpdateDraft({ defaultLanguage: value })}
          />
        </Field>

        <Field
          showLabel
          label={t.coreSettings.workspaceTimezone}
          hint={t.coreSettings.workspaceTimezoneHint}
          error={fieldError?.field === "timezone" ? fieldError.message : undefined}
          readOnly={isReadOnly}
          required
        >
          {timezones.hasZones ? (
            <Combobox
              value={draft.timezone}
              selectedLabel={draft.timezone}
              onValueChange={(value) => onUpdateDraft({ timezone: value ?? "" })}
              options={timezones.options}
              onSearch={timezones.onSearch}
              placeholder={t.coreSettings.workspaceTimezonePlaceholder}
              searchPlaceholder={t.coreSettings.workspaceTimezoneSearch}
              loadingLabel={t.common.loading}
              emptyLabel={t.coreSettings.workspaceTimezoneEmpty}
              disabled={isReadOnly || isSaving}
              readOnly={isReadOnly}
            />
          ) : (
            <Input
              size="sm"
              value={draft.timezone}
              placeholder={t.coreSettings.workspaceTimezonePlaceholder}
              onChange={(event) => onUpdateDraft({ timezone: event.target.value })}
              maxLength={TIMEZONE_MAX_LENGTH}
              disabled={isSaving}
              readOnly={isReadOnly}
              dir="ltr"
            />
          )}
        </Field>
      </CardContent>
    </Card>
  );
}

interface LanguageRadioGroupProps {
  value: string;
  disabled: boolean;
  groupLabel: string;
  labels: Dictionary["coreSettings"]["languageNames"];
  onSelect: (next: string) => void;
}

function LanguageRadioGroup({
  value,
  disabled,
  groupLabel,
  labels,
  onSelect,
}: LanguageRadioGroupProps) {
  const dir = useDirection();
  const fieldControl = useFieldControl();
  const normalized = value.trim().toLowerCase();

  return (
    <RadioGroup
      {...fieldControl}
      dir={dir}
      aria-label={groupLabel}
      value={normalized}
      onValueChange={onSelect}
      disabled={disabled}
      className="grid gap-2.5 sm:grid-cols-2"
    >
      {WORKSPACE_LANGUAGES.map((code) => {
        const selected = normalized === code;
        const itemId = `workspace-lang-${code}`;
        return (
          <Label
            key={code}
            htmlFor={itemId}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors",
              selected
                ? "border-primary bg-selected text-foreground ring-1 ring-primary/20"
                : "border-border bg-card text-foreground",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <RadioGroupItem id={itemId} value={code} />
            <span>{labels[code]}</span>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
