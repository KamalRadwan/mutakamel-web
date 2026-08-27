"use client";

import {
  AlertTriangle,
  Sliders,
  Save,
  Loader2,
  Globe,
  SunMoon,
  LayoutGrid,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Card, Button } from "@/design-system";
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
        <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-brand-600 dark:text-brand-400" aria-hidden="true" />
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
            <ShieldAlert className="mx-auto size-8 text-warn-600 dark:text-warn-400" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mx-auto size-8 text-danger-600 dark:text-danger-400" aria-hidden="true" />
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
      <Card className="flex items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
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
          {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          <span>{t.savePreferencesButton}</span>
        </Button>
      </Card>

      {saveError ? (
        <div role="alert" className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-xs text-danger-900 dark:border-danger-800/60 dark:bg-danger-950/40 dark:text-danger-100">
          <p className="font-semibold">{t.changesNotSavedTitle}</p>
          <p className="mt-1 font-mono">
            {saveError.errorCode}
            {saveError.correlationId ? ` · ${saveError.correlationId}` : ""}
          </p>
        </div>
      ) : null}

      <Card className="space-y-6 p-6">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <SunMoon className="size-4 text-warn-600 dark:text-warn-400" aria-hidden="true" />
            <span>{t.colorThemeLabel}</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <OptionButton label={t.darkModeOption} selected={themeKey === "dark"} onClick={() => setThemeKey("dark")} />
            <OptionButton label={t.lightModeOption} selected={themeKey === "light"} onClick={() => setThemeKey("light")} />
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Globe className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <span>{t.preferredLanguageLabel}</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <OptionButton label="English (LTR)" selected={language === "en"} onClick={() => setLanguage("en")} />
            <OptionButton label="العربية (RTL)" selected={language === "ar"} onClick={() => setLanguage("ar")} />
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <LayoutGrid className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <span>{t.tableDensityLabel}</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {["compact", "comfortable", "spacious"].map((density) => (
              <OptionButton
                key={density}
                label={density}
                capitalize
                selected={tableDensity === density}
                onClick={() => setTableDensity(density)}
              />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function OptionButton({
  label,
  selected,
  onClick,
  capitalize = false,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  capitalize?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between rounded-xl border p-3 text-xs font-semibold transition-colors ${capitalize ? "capitalize" : ""} ${
        selected
          ? "border-brand-500 bg-brand-500/10 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
          : "border-border text-muted-foreground"
      }`}
    >
      <span>{label}</span>
      {selected && <CheckCircle2 className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />}
    </button>
  );
}
