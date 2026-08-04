"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Sliders, Save, Loader2, Globe, SunMoon, LayoutGrid, CheckCircle2 } from "lucide-react";
import { useMyProfile } from "./hooks/useMyProfile";

export default function MyProfilePage() {
  const {
    lang,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    profile,
    themeKey,
    setThemeKey,
    language,
    setLanguage,
    tableDensity,
    setTableDensity,
    isLoading,
    isSaving,
    hasChanges,
    saveProfile,
  } = useMyProfile();

  const isAr = lang === "ar";

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-[#090d16] dark:text-slate-100">
        <Navbar />
        <main className="grid flex-1 place-items-center p-6">
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            {isAr ? "جارٍ تحميل التفضيلات..." : "Loading profile preferences..."}
          </span>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-3xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-900/50 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
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
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isAr ? "حفظ التغييرات" : "Save Preferences"}</span>
          </button>
        </div>

        {/* Preferences Form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs p-6 space-y-6">
          {/* Theme Key */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <SunMoon className="w-4 h-4 text-amber-500" />
              <span>{isAr ? "المظهر والشاشات (Theme Key)" : "Color Theme Preference"}</span>
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
                {themeKey === "dark" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
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
                {themeKey === "light" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
              </button>
            </div>
          </div>

          {/* Language Preference */}
          <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
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
                {language === "en" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
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
                {language === "ar" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
              </button>
            </div>
          </div>

          {/* Table Density */}
          <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-blue-500" />
              <span>{isAr ? "كثافة الجداول (Table Density)" : "Table Layout Density"}</span>
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
                  {tableDensity === density && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
