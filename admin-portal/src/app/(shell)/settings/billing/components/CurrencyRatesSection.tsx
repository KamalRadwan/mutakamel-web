"use client";

import { useState, useEffect } from "react";
import { useCurrencyRates } from "../hooks/useCurrencyRates";
import { Coins, Plus, Edit2, Loader2, RefreshCw, CheckCircle2, XCircle, DollarSign } from "lucide-react";
import {
  Card,
  Button,
  Input,
  Textarea,
  Checkbox,
  Badge,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  type ColumnDef,
} from "@/design-system";
import type { CurrencyRateView } from "../hooks/useCurrencyRates";

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

  const columns: ColumnDef<CurrencyRateView>[] = [
    {
      key: "currency",
      headerEn: lang === "ar" ? "العملة" : "Currency",
      headerAr: lang === "ar" ? "العملة" : "Currency",
      cell: (rate) => <span className="font-mono font-semibold text-foreground">{rate.currencyCode}</span>,
    },
    {
      key: "rate",
      headerEn: lang === "ar" ? "الوحدات مقابل 1.00 USD" : "Units per 1.00 USD",
      headerAr: lang === "ar" ? "الوحدات مقابل 1.00 USD" : "Units per 1.00 USD",
      cell: (rate) => <span className="font-mono text-foreground">{formatCurrencyRate(rate.currencyUnitsPerUsd)}</span>,
    },
    {
      key: "status",
      headerEn: lang === "ar" ? "الحالة" : "Status",
      headerAr: lang === "ar" ? "الحالة" : "Status",
      cell: (rate) =>
        rate.isActive ? (
          <Badge tone="brand">
            <CheckCircle2 className="size-3" aria-hidden="true" />
            {lang === "ar" ? "نشط" : "Active"}
          </Badge>
        ) : (
          <Badge tone="neutral">
            <XCircle className="size-3" aria-hidden="true" />
            {lang === "ar" ? "غير نشط" : "Inactive"}
          </Badge>
        ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            headerEn: lang === "ar" ? "الإجراءات" : "Actions",
            headerAr: lang === "ar" ? "الإجراءات" : "Actions",
            align: "end" as const,
            cell: (rate: CurrencyRateView) => (
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleRateStatus(rate)}>
                  {rate.isActive
                    ? lang === "ar" ? "تعطيل" : "Deactivate"
                    : lang === "ar" ? "تفعيل" : "Activate"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  title={lang === "ar" ? "تعديل" : "Edit"}
                  onClick={() => {
                    setEditingRate(rate);
                    setIsAddModalOpen(true);
                  }}
                >
                  <Edit2 className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-500/10 p-2.5 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
            <Coins className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {lang === "ar" ? "أسعار صرف العملات" : "Currency Exchange Rates"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {lang === "ar"
                ? "إدارة أسعار الصرف بالنسبة للعملة الأساسية (الدولار الأمريكي USD 1.00)."
                : "Manage foreign exchange conversion units per 1.00 USD."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={fetchRates} disabled={isLoading} title={lang === "ar" ? "تحديث" : "Refresh"}>
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            {lang === "ar" ? "تحديث" : "Refresh"}
          </Button>

          {canManage && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setBatchText(rates.map((rate) => `${rate.currencyCode},${rate.currencyUnitsPerUsd},${rate.isActive}`).join("\n"));
                  setIsBatchOpen(true);
                }}
              >
                {lang === "ar" ? "تعديل جماعي" : "Batch edit"}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingRate(null);
                  setIsAddModalOpen(true);
                }}
              >
                <Plus className="size-4" aria-hidden="true" />
                {lang === "ar" ? "إضافة عملة" : "Add Currency Rate"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border bg-muted px-5 py-3 text-xs text-muted-foreground">
        <DollarSign className="size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-foreground">USD (USD 1.00)</strong>{" "}
          {lang === "ar" ? "هي العملة الأساسية للنظام ولا تتغير." : "is the system base currency (fixed)."}&nbsp;
          <span className="font-semibold text-muted-foreground">
            ({lang === "ar" ? "إجمالي العملات المدارة:" : "Total Managed Currencies:"} {rates.length + 1})
          </span>
        </span>
      </div>

      <div className="p-5">
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-danger-200 bg-danger-50 p-3 text-xs text-danger-700 dark:border-danger-800/60 dark:bg-danger-950/30 dark:text-danger-300">
            {error}
          </div>
        )}
        {rates.length === 0 && !isLoading ? (
          <div className="py-8 text-center">
            <Coins className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs font-medium text-muted-foreground">
              {lang === "ar" ? "لا توجد عملات إضافية معرفة بعد." : "No foreign exchange rates defined yet."}
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={rates}
            isLoading={isLoading}
            getRowId={(rate) => rate.currencyCode}
            pagination={{
              page: 1,
              limit: Math.max(rates.length, 1),
              totalItems: rates.length,
              totalPages: 1,
              onPageChange: () => {},
            }}
          />
        )}
      </div>

      <Dialog open={isAddModalOpen || Boolean(editingRate)} onOpenChange={(open) => { if (!open) { setIsAddModalOpen(false); setEditingRate(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingRate
                ? lang === "ar"
                  ? `تعديل سعر صرف (${editingRate.currencyCode})`
                  : `Edit Exchange Rate (${editingRate.currencyCode})`
                : lang === "ar"
                  ? "إضافة سعر صرف جديد"
                  : "Add New Exchange Rate"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                {lang === "ar" ? "رمز العملة (3 أحرف ISO)" : "Currency Code (3 ISO Letters)"}
              </label>
              <Input
                type="text"
                maxLength={3}
                required
                disabled={Boolean(editingRate)}
                value={formCurrencyCode}
                onChange={(e) => setFormCurrencyCode(e.target.value.toUpperCase())}
                placeholder="EUR, EGP, SAR..."
                className="font-mono"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                {lang === "ar" ? "الوحدات مقابل 1.00 USD" : "Units per 1.00 USD"}
              </label>
              <Input
                type="text"
                required
                value={formUnitsPerUsd}
                onChange={(e) => setFormUnitsPerUsd(e.target.value)}
                placeholder="e.g. 48.50"
                className="font-mono"
              />
            </div>

            <label className="flex items-center gap-2 pt-1 text-xs font-semibold text-muted-foreground">
              <Checkbox checked={formIsActive} onCheckedChange={(checked) => setFormIsActive(checked === true)} />
              {lang === "ar" ? "تفعيل هذه العملة" : "Active currency rate"}
            </label>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingRate(null);
                }}
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                {lang === "ar" ? "حفظ" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBatchOpen} onOpenChange={(open) => !open && setIsBatchOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{lang === "ar" ? "تعديل أسعار الصرف جماعياً" : "Batch edit currency rates"}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {lang === "ar" ? "سطر لكل عملة: الرمز، السعر، الحالة." : "One line per currency: CODE,RATE,ACTIVE. Omitted currencies stay unchanged."}
            </p>
          </DialogHeader>
          <form onSubmit={handleBatchSubmit} className="space-y-4">
            <Textarea
              value={batchText}
              onChange={(event) => setBatchText(event.target.value)}
              rows={10}
              spellCheck={false}
              placeholder="EUR,0.9300,true"
              className="resize-none font-mono"
            />
            {batchError && (
              <p role="alert" className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-xs text-danger-700 dark:border-danger-800/60 dark:bg-danger-950/30 dark:text-danger-300">
                {batchError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsBatchOpen(false)}>
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                {lang === "ar" ? "حفظ الكل" : "Save batch"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
