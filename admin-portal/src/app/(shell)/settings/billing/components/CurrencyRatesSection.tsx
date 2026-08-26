"use client";

import { useState, useEffect } from "react";
import { useCurrencyRates } from "../hooks/useCurrencyRates";
import { Coins, Plus, Edit2, Loader2, RefreshCw, CheckCircle2, XCircle, DollarSign } from "lucide-react";

function formatCurrencyRate(val: string): string {
  const [whole, fraction = ""] = val.split(".");
  const compactFraction = fraction.replace(/0+$/, "");
  return compactFraction ? `${whole}.${compactFraction}` : whole;
}

export function CurrencyRatesSection() {
  const {
    lang,
    rates,
    isLoading,
    isSaving,
    error,
    canRead,
    canManage,
    isAddModalOpen,
    setIsAddModalOpen,
    editingRate,
    setEditingRate,
    fetchRates,
    upsertRate,
    toggleRateStatus,
    batchUpsertRates,
  } = useCurrencyRates();

  const [formCurrencyCode, setFormCurrencyCode] = useState("");
  const [formUnitsPerUsd, setFormUnitsPerUsd] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchError, setBatchError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      if (editingRate) {
        setFormCurrencyCode(editingRate.currencyCode);
        setFormUnitsPerUsd(editingRate.currencyUnitsPerUsd);
        setFormIsActive(editingRate.isActive);
      } else {
        setFormCurrencyCode("");
        setFormUnitsPerUsd("");
        setFormIsActive(true);
      }
    });
  }, [editingRate, isAddModalOpen]);

  if (!canRead) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await upsertRate(formCurrencyCode, formUnitsPerUsd, formIsActive);
    if (success) {
      setFormCurrencyCode("");
      setFormUnitsPerUsd("");
    }
  };

  const handleBatchSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBatchError(null);
    try {
      const rates = batchText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
        const [currencyCode, currencyUnitsPerUsd, active = "true"] = line.split(",").map((part) => part.trim());
        if (!currencyCode || !currencyUnitsPerUsd) throw new Error("Each line must be CODE,RATE[,ACTIVE].");
        return { currencyCode, currencyUnitsPerUsd, isActive: active.toLowerCase() !== "false" };
      });
      if (!rates.length) throw new Error("Add at least one currency rate.");
      if (await batchUpsertRates(rates)) {
        setIsBatchOpen(false);
        setBatchText("");
      }
    } catch (submissionError) {
      setBatchError(submissionError instanceof Error ? submissionError.message : "Batch rates are invalid.");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
      {/* Section Header */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {lang === "ar" ? "أسعار صرف العملات" : "Currency Exchange Rates"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === "ar"
                ? "إدارة أسعار الصرف بالنسبة للعملة الأساسية (الدولار الأمريكي USD 1.00)."
                : "Manage foreign exchange conversion units per 1.00 USD."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchRates}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            title={lang === "ar" ? "تحديث" : "Refresh"}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            {lang === "ar" ? "تحديث" : "Refresh"}
          </button>

          {canManage && (
            <><button type="button" onClick={() => { setBatchText(rates.map((rate) => `${rate.currencyCode},${rate.currencyUnitsPerUsd},${rate.isActive}`).join("\n")); setIsBatchOpen(true); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/30">{lang === "ar" ? "تعديل جماعي" : "Batch edit"}</button><button
              type="button"
              onClick={() => {
                setEditingRate(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-500 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              {lang === "ar" ? "إضافة عملة" : "Add Currency Rate"}
            </button></>
          )}
        </div>
      </div>

      {/* Base Currency Badge */}
      <div className="bg-slate-50 dark:bg-slate-950/50 px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
        <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>
          <strong className="font-bold text-slate-900 dark:text-slate-200">USD (USD 1.00)</strong>{" "}
          {lang === "ar" ? "هي العملة الأساسية للنظام ولا تتغير." : "is the system base currency (fixed)."}&nbsp;
          <span className="font-semibold text-slate-500">
            ({lang === "ar" ? "إجمالي العملات المدارة:" : "Total Managed Currencies:"} {rates.length + 1})
          </span>
        </span>
      </div>

      {/* Rates Table / List */}
      <div className="p-5">
        {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin me-2" />
            <span className="text-xs">{lang === "ar" ? "جاري تحميل أسعار الصرف..." : "Loading exchange rates..."}</span>
          </div>
        ) : rates.length === 0 ? (
          <div className="text-center py-8">
            <Coins className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {lang === "ar" ? "لا توجد عملات إضافية معرفة بعد." : "No foreign exchange rates defined yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="py-2.5 px-3 text-start">{lang === "ar" ? "العملة" : "Currency"}</th>
                  <th className="py-2.5 px-3 text-start">{lang === "ar" ? "الوحدات مقابل 1.00 USD" : "Units per 1.00 USD"}</th>
                  <th className="py-2.5 px-3 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
                  {canManage && <th className="py-2.5 px-3 text-end">{lang === "ar" ? "الإجراءات" : "Actions"}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {rates.map((rate) => (
                  <tr key={rate.currencyCode} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {rate.currencyCode}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                      {formatCurrencyRate(rate.currencyUnitsPerUsd)}
                    </td>
                    <td className="py-3 px-3">
                      {rate.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          {lang === "ar" ? "نشط" : "Active"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          <XCircle className="w-3 h-3" />
                          {lang === "ar" ? "غير نشط" : "Inactive"}
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="py-3 px-3 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => toggleRateStatus(rate)}
                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                          >
                            {rate.isActive
                              ? lang === "ar" ? "تعطيل" : "Deactivate"
                              : lang === "ar" ? "تفعيل" : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRate(rate);
                              setIsAddModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title={lang === "ar" ? "تعديل" : "Edit"}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {(isAddModalOpen || editingRate) && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {editingRate
                ? lang === "ar"
                  ? `تعديل سعر صرف (${editingRate.currencyCode})`
                  : `Edit Exchange Rate (${editingRate.currencyCode})`
                : lang === "ar"
                ? "إضافة سعر صرف جديد"
                : "Add New Exchange Rate"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "ar" ? "رمز العملة (3 أحرف ISO)" : "Currency Code (3 ISO Letters)"}
                </label>
                <input
                  type="text"
                  maxLength={3}
                  required
                  disabled={Boolean(editingRate)}
                  value={formCurrencyCode}
                  onChange={(e) => setFormCurrencyCode(e.target.value.toUpperCase())}
                  placeholder="EUR, EGP, SAR..."
                  className="w-full h-9 px-3 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "ar" ? "الوحدات مقابل 1.00 USD" : "Units per 1.00 USD"}
                </label>
                <input
                  type="text"
                  required
                  value={formUnitsPerUsd}
                  onChange={(e) => setFormUnitsPerUsd(e.target.value)}
                  placeholder="e.g. 48.50"
                  className="w-full h-9 px-3 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="formIsActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="formIsActive" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  {lang === "ar" ? "تفعيل هذه العملة" : "Active currency rate"}
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingRate(null);
                  }}
                  className="h-9 px-4 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-9 px-4 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {lang === "ar" ? "حفظ" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isBatchOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="batch-rates-title" className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"><div><h3 id="batch-rates-title" className="text-base font-bold">{lang === "ar" ? "تعديل أسعار الصرف جماعياً" : "Batch edit currency rates"}</h3><p className="mt-1 text-xs text-slate-500">{lang === "ar" ? "سطر لكل عملة: الرمز، السعر، الحالة." : "One line per currency: CODE,RATE,ACTIVE. Omitted currencies stay unchanged."}</p></div><form onSubmit={handleBatchSubmit} className="space-y-4"><textarea value={batchText} onChange={(event) => setBatchText(event.target.value)} rows={10} spellCheck={false} placeholder="EUR,0.9300,true" className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950" />{batchError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{batchError}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setIsBatchOpen(false)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{lang === "ar" ? "إلغاء" : "Cancel"}</button><button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{lang === "ar" ? "حفظ الكل" : "Save batch"}</button></div></form></div></div>}
    </div>
  );
}
