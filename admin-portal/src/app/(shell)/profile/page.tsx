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

  if (isLoading) {
    return (
      <div dir={isAr ? "rtl" : "ltr"} className="grid place-items-center py-16">
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          {isAr
            ? "جارٍ تحميل التفضيلات..."
            : "Loading profile preferences..."}
        </span>
      </div>
    );
  }

  if (loadError) {
    const forbidden = loadError.httpStatus === 403;
    const unavailable = [0, 502, 503, 504].includes(loadError.httpStatus);
    return (
      <div dir={isAr ? "rtl" : "ltr"} className="grid place-items-center py-16">
          <section
            role={forbidden ? undefined : "alert"}
            className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950"
          >
            {forbidden ? (
              <ShieldAlert className="mx-auto size-8 text-amber-500" />
            ) : (
              <AlertTriangle className="mx-auto size-8 text-rose-500" />
            )}
            <h1 className="mt-3 text-lg font-semibold">
              {forbidden
                ? isAr
                  ? "لا يمكنك عرض هذا الملف الشخصي"
                  : "Profile access is forbidden"
                : unavailable
                  ? isAr
                    ? "الملف الشخصي غير متاح مؤقتًا"
                    : "Profile is temporarily unavailable"
                  : isAr
                    ? "تعذر تحميل الملف الشخصي"
                    : "Profile could not be loaded"}
            </h1>
            <dl className="mt-3 space-y-1 text-xs text-slate-500">
              <div>
                <dt className="inline font-semibold">
                  {isAr ? "رمز الخطأ" : "Error code"}:{" "}
                </dt>
                <dd className="inline font-mono">{loadError.errorCode}</dd>
              </div>
              {loadError.correlationId ? (
                <div>
                  <dt className="inline font-semibold">
                    {isAr ? "معرف الارتباط" : "Correlation ID"}:{" "}
                  </dt>
                  <dd className="inline break-all font-mono">
                    {loadError.correlationId}
                  </dd>
                </div>
              ) : null}
            </dl>
            {!forbidden ? (
              <button
                type="button"
                onClick={() => void reload()}
                className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500"
              >
                <RefreshCw className="size-4" />
                {isAr ? "إعادة المحاولة" : "Retry"}
              </button>
            ) : null}
          </section>
      </div>
    );
  }

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="space-y-6 w-full">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-900/50 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isAr ? "تفضيلات الحساب الشخصي" : "My Profile Preferences"}
              </h1>
              <p className="text-xs text-slate-500">
                {isAr
                  ? "تخصيص المظهر، اللغة، وكثافة عرض الجداول الخاصة بحسابك."
                  : "Customize theme, interface language, and table density settings."}
              </p>
            </div>
          </div>

          <button
            disabled={!hasChanges || isSaving}
            onClick={saveProfile}
            className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-600/20 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isAr ? "حفظ التغييرات" : "Save Preferences"}</span>
          </button>
        </div>

        {saveError ? (
          <section
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
          >
            <p className="font-semibold">
              {isAr ? "لم تُحفظ التغييرات." : "Changes were not saved."}
            </p>
            <p className="mt-1 font-mono">
              {saveError.errorCode}
              {saveError.correlationId ? ` · ${saveError.correlationId}` : ""}
            </p>
          </section>
        ) : null}

        {/* Preferences Form */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-6 space-y-6">
          {/* Theme Key */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <SunMoon className="w-4 h-4 text-amber-500" />
              <span>
                {isAr
                  ? "المظهر والشاشات (Theme Key)"
                  : "Color Theme Preference"}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setThemeKey("dark")}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  themeKey === "dark"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <span>{isAr ? "داكن (Dark)" : "Dark Mode"}</span>
                {themeKey === "dark" && (
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setThemeKey("light")}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  themeKey === "light"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <span>{isAr ? "فاتح (Light)" : "Light Mode"}</span>
                {themeKey === "light" && (
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                )}
              </button>
            </div>
          </div>

          {/* Language Preference */}
          <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-500" />
              <span>{isAr ? "اللغة المفضلة" : "Preferred Language"}</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  language === "en"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <span>English (LTR)</span>
                {language === "en" && (
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setLanguage("ar")}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  language === "ar"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <span>العربية (RTL)</span>
                {language === "ar" && (
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                )}
              </button>
            </div>
          </div>

          {/* Table Density */}
          <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-blue-500" />
              <span>
                {isAr
                  ? "كثافة الجداول (Table Density)"
                  : "Table Layout Density"}
              </span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {["compact", "comfortable", "spacious"].map((density) => (
                <button
                  key={density}
                  type="button"
                  onClick={() => setTableDensity(density)}
                  className={`p-3 rounded-xl border text-xs font-semibold capitalize flex items-center justify-between transition-colors cursor-pointer ${
                    tableDensity === density
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span>{density}</span>
                  {tableDensity === density && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
    </div>
  );
}
