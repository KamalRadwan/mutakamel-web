"use client";

import {
  AlertTriangle,
  Sliders,
  Save,
  Loader2,
  Globe,
  SunMoon,
  LayoutGrid,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Button, Card, RadioGroup, RadioGroupItem } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { useMyProfile } from "./hooks/useMyProfile";

export default function MyProfilePage() {
  const {
    lang,
    themeKey,
    setThemeKey,
    language,
    setLanguage,
    tableDensity,
    setTableDensity,
    isLoading,
    isSaving,
    loadError,
    saveError,
    hasChanges,
    saveProfile,
    reload,
  } = useMyProfile();

  const isAr = lang === "ar";
  const t = (isAr ? ar : en).profile;

  if (isLoading) {
    return (
      <div dir={isAr ? "rtl" : "ltr"} className="grid place-items-center py-16">
        <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
          {t.loadingPreferences}
        </span>
      </div>
    );
  }

  if (loadError) {
    const forbidden = loadError.httpStatus === 403;
    const unavailable = [0, 502, 503, 504].includes(loadError.httpStatus);
    return (
      <div dir={isAr ? "rtl" : "ltr"} className="grid place-items-center py-16">
        <Card role={forbidden ? undefined : "alert"} className="w-full max-w-xl p-3 sm:p-3.5 text-center">
          {forbidden ? (
            <ShieldAlert className="mx-auto size-7 text-warning" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mx-auto size-7 text-destructive" aria-hidden="true" />
          )}
          <h1 className="mt-2 text-base font-semibold text-foreground">
            {forbidden
              ? t.accessForbiddenTitle
              : unavailable
                ? t.temporarilyUnavailableTitle
                : t.couldNotLoadTitle}
          </h1>
          <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
            <div>
              <dt className="inline font-semibold">{t.errorCodeLabel}: </dt>
              <dd className="inline font-mono">{loadError.errorCode}</dd>
            </div>
            {loadError.correlationId ? (
              <div>
                <dt className="inline font-semibold">{t.correlationIdLabel}: </dt>
                <dd className="inline break-all font-mono">{loadError.correlationId}</dd>
              </div>
            ) : null}
          </dl>
          {!forbidden ? (
            <Button type="button" variant="primary" size="sm" className="mt-4" onClick={() => void reload()}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              {t.retryButton}
            </Button>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="w-full space-y-3">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-3.5">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-info-subtle text-info-subtle-foreground">
            <Sliders className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-semibold text-foreground">
              {t.pageTitle}
            </h1>
          </div>
        </div>

        <Button type="button" variant="primary" size="sm" disabled={!hasChanges || isSaving} onClick={saveProfile}>
          {isSaving ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="size-3.5" aria-hidden="true" />}
          <span>{t.savePreferencesButton}</span>
        </Button>
      </Card>

      {saveError ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground">
          <p className="font-semibold">{t.changesNotSavedTitle}</p>
          <p className="mt-1 font-mono">
            {saveError.errorCode}
            {saveError.correlationId ? ` · ${saveError.correlationId}` : ""}
          </p>
        </div>
      ) : null}

      <Card className="space-y-3 p-3 sm:p-3.5">
        <fieldset className="space-y-2">
          <legend className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <SunMoon className="size-3.5 text-warning" aria-hidden="true" />
            <span>{t.colorThemeLabel}</span>
          </legend>
          <RadioGroup
            value={themeKey}
            onValueChange={setThemeKey}
            aria-label={t.colorThemeLabel}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            <OptionRadio id="profile-theme-dark" value="dark" label={t.darkModeOption} selected={themeKey === "dark"} />
            <OptionRadio id="profile-theme-light" value="light" label={t.lightModeOption} selected={themeKey === "light"} />
          </RadioGroup>
        </fieldset>

        <fieldset className="space-y-2 border-t border-border pt-3">
          <legend className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Globe className="size-3.5 text-info" aria-hidden="true" />
            <span>{t.preferredLanguageLabel}</span>
          </legend>
          <RadioGroup
            value={language}
            onValueChange={setLanguage}
            aria-label={t.preferredLanguageLabel}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            <OptionRadio id="profile-language-en" value="en" label="English (LTR)" selected={language === "en"} />
            <OptionRadio id="profile-language-ar" value="ar" label="العربية (RTL)" selected={language === "ar"} />
          </RadioGroup>
        </fieldset>

        <fieldset className="space-y-2 border-t border-border pt-3">
          <legend className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <LayoutGrid className="size-3.5 text-info" aria-hidden="true" />
            <span>{t.tableDensityLabel}</span>
          </legend>
          <RadioGroup
            value={tableDensity}
            onValueChange={setTableDensity}
            aria-label={t.tableDensityLabel}
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          >
            {[
              { value: "compact", label: t.compactDensityOption },
              { value: "comfortable", label: t.comfortableDensityOption },
              { value: "spacious", label: t.spaciousDensityOption },
            ].map((option) => (
              <OptionRadio
                key={option.value}
                id={`profile-density-${option.value}`}
                value={option.value}
                label={option.label}
                selected={tableDensity === option.value}
              />
            ))}
          </RadioGroup>
        </fieldset>
      </Card>
    </div>
  );
}

function OptionRadio({
  id,
  value,
  label,
  selected,
}: {
  id: string;
  value: string;
  label: string;
  selected: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex min-h-8 cursor-pointer items-center gap-2 rounded-md border p-2 text-xs font-semibold transition-colors motion-reduce:transition-none ${
        selected
          ? "border-primary bg-selected text-selected-foreground"
          : "border-input bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      <RadioGroupItem id={id} value={value} />
      <span>{label}</span>
    </label>
  );
}
