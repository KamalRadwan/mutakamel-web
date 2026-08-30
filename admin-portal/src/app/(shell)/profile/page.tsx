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
          <Loader2 className="size-5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
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
        <Card role={forbidden ? undefined : "alert"} className="w-full max-w-xl p-6 text-center">
          {forbidden ? (
            <ShieldAlert className="mx-auto size-8 text-warning" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mx-auto size-8 text-destructive" aria-hidden="true" />
          )}
          <h1 className="mt-3 text-lg font-semibold text-foreground">
            {forbidden
              ? t.accessForbiddenTitle
              : unavailable
                ? t.temporarilyUnavailableTitle
                : t.couldNotLoadTitle}
          </h1>
          <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
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
            <Button type="button" variant="primary" className="mt-5" onClick={() => void reload()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              {t.retryButton}
            </Button>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="w-full space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-info-subtle text-info-subtle-foreground">
            <Sliders className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {t.pageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t.pageSubtitle}
            </p>
          </div>
        </div>

        <Button type="button" variant="primary" disabled={!hasChanges || isSaving} onClick={saveProfile}>
          {isSaving ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          <span>{t.savePreferencesButton}</span>
        </Button>
      </Card>

      {saveError ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive-subtle p-3 text-xs text-destructive-subtle-foreground">
          <p className="font-semibold">{t.changesNotSavedTitle}</p>
          <p className="mt-1 font-mono">
            {saveError.errorCode}
            {saveError.correlationId ? ` · ${saveError.correlationId}` : ""}
          </p>
        </div>
      ) : null}

      <Card className="space-y-6 p-6">
        <fieldset className="space-y-2">
          <legend className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <SunMoon className="size-4 text-warning" aria-hidden="true" />
            <span>{t.colorThemeLabel}</span>
          </legend>
          <RadioGroup
            value={themeKey}
            onValueChange={setThemeKey}
            aria-label={t.colorThemeLabel}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <OptionRadio id="profile-theme-dark" value="dark" label={t.darkModeOption} selected={themeKey === "dark"} />
            <OptionRadio id="profile-theme-light" value="light" label={t.lightModeOption} selected={themeKey === "light"} />
          </RadioGroup>
        </fieldset>

        <fieldset className="space-y-2 border-t border-border pt-4">
          <legend className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Globe className="size-4 text-info" aria-hidden="true" />
            <span>{t.preferredLanguageLabel}</span>
          </legend>
          <RadioGroup
            value={language}
            onValueChange={setLanguage}
            aria-label={t.preferredLanguageLabel}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <OptionRadio id="profile-language-en" value="en" label="English (LTR)" selected={language === "en"} />
            <OptionRadio id="profile-language-ar" value="ar" label="العربية (RTL)" selected={language === "ar"} />
          </RadioGroup>
        </fieldset>

        <fieldset className="space-y-2 border-t border-border pt-4">
          <legend className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <LayoutGrid className="size-4 text-info" aria-hidden="true" />
            <span>{t.tableDensityLabel}</span>
          </legend>
          <RadioGroup
            value={tableDensity}
            onValueChange={setTableDensity}
            aria-label={t.tableDensityLabel}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
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
      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-xs font-semibold transition-colors motion-reduce:transition-none ${
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
