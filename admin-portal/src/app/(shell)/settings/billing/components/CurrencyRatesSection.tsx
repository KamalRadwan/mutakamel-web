"use client";

import { useState, useEffect } from "react";
import { useCurrencyRates } from "../hooks/useCurrencyRates";
import { useI18n } from "@/i18n/I18nContext";
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
import { parseCurrencyRateLines } from "./parse-currency-rate-lines";

function formatCurrencyRate(val: string): string {
  const [whole, fraction = ""] = val.split(".");
  const compactFraction = fraction.replace(/0+$/, "");
  return compactFraction ? `${whole}.${compactFraction}` : whole;
}

export function CurrencyRatesSection() {
  const {
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
  const { t } = useI18n();
  const copy = t.settings.currencyRates;

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
      const rates = parseCurrencyRateLines(batchText, copy.validation);
      if (!rates.length) throw new Error(copy.validation.atLeastOneRate);
      if (await batchUpsertRates(rates)) {
        setIsBatchOpen(false);
        setBatchText("");
      }
    } catch (submissionError) {
      setBatchError(submissionError instanceof Error ? submissionError.message : copy.validation.batchInvalid);
    }
  };

  const columns: ColumnDef<CurrencyRateView>[] = [
    {
      key: "currency",
      headerEn: copy.table.currency,
      headerAr: copy.table.currency,
      cell: (rate) => <span className="font-mono font-semibold text-foreground">{rate.currencyCode}</span>,
    },
    {
      key: "rate",
      headerEn: copy.table.rate,
      headerAr: copy.table.rate,
      cell: (rate) => <span className="font-mono text-foreground">{formatCurrencyRate(rate.currencyUnitsPerUsd)}</span>,
    },
    {
      key: "status",
      headerEn: copy.table.status,
      headerAr: copy.table.status,
      cell: (rate) =>
        rate.isActive ? (
          <Badge tone="brand">
            <CheckCircle2 className="size-3" aria-hidden="true" />
            {copy.statusActive}
          </Badge>
        ) : (
          <Badge tone="neutral">
            <XCircle className="size-3" aria-hidden="true" />
            {copy.statusInactive}
          </Badge>
        ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            headerEn: copy.table.actions,
            headerAr: copy.table.actions,
            align: "end" as const,
            cell: (rate: CurrencyRateView) => (
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleRateStatus(rate)}>
                  {rate.isActive ? copy.deactivate : copy.activate}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  title={copy.edit}
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
          <div className="rounded-lg bg-info-subtle p-2.5 text-info-subtle-foreground">
            <Coins className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {copy.title}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {copy.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={fetchRates} disabled={isLoading} title={copy.refresh}>
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
            {copy.refresh}
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
                {copy.batchEdit}
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
                {copy.addCurrency}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border bg-muted px-5 py-3 text-xs text-muted-foreground">
        <DollarSign className="size-4 shrink-0 text-info" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-foreground">{copy.baseCurrencyLabel}</strong>{" "}
          {copy.baseCurrencyNote}&nbsp;
          <span className="font-semibold text-muted-foreground">
            ({copy.totalManaged} {rates.length + 1})
          </span>
        </span>
      </div>

      <div className="p-5">
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive-subtle p-3 text-xs text-destructive-subtle-foreground">
            {error}
          </div>
        )}
        {rates.length === 0 && !isLoading ? (
          <div className="py-8 text-center">
            <Coins className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs font-medium text-muted-foreground">
              {copy.empty}
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
              {editingRate ? copy.editRateTitle(editingRate.currencyCode) : copy.addRateTitle}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                {copy.currencyCodeLabel}
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
                {copy.unitsLabel}
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
              {copy.activeLabel}
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
                {copy.cancel}
              </Button>
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {copy.save}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBatchOpen} onOpenChange={(open) => !open && setIsBatchOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{copy.batchDialogTitle}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {copy.batchDialogDescription}
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
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive-subtle p-3 text-xs text-destructive-subtle-foreground">
                {batchError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsBatchOpen(false)}>
                {copy.cancel}
              </Button>
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {copy.saveBatch}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
