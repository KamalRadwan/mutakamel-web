"use client";

import {
  IdentifierText,
  Money,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { compareFixedDecimal, multiplyFixedDecimal } from "../../documents/fixed-decimal";
import { isTradeDecimal } from "../../documents/trade-document-contract";
import type { QuotationPricingMode } from "../quotation-discount-contract";
import type { QuotationSavedLine, QuotationSavedLineDisplay } from "../quotation-saved-presentation";
import { QuotationDeductionRow } from "./QuotationDeductionRow";
import { QuotationItemIdentity, QuotationItemThumbnail } from "./QuotationItemIdentity";

export function QuotationSavedLines({
  lines,
  mode,
  discountScope,
  discountAmount,
  currencyCode,
  lineDisplayById,
}: {
  lines: QuotationSavedLine[];
  mode: QuotationPricingMode;
  discountScope?: "LINE" | "DOCUMENT";
  discountAmount?: string;
  currencyCode?: string;
  lineDisplayById?: Record<string, QuotationSavedLineDisplay>;
}) {
  const { t, lang } = useI18n();
  const copy = t.quotationExperience;
  const descriptionLabel = t.coreOperations.templates.description;
  const promotion = mode === "PROMOTIONS";
  const showLineDiscount = mode === "DISCOUNT" && discountScope !== "DOCUMENT";
  const showDeduction = mode !== "NONE" && discountAmount !== undefined && compareFixedDecimal(discountAmount, "0") > 0;
  const unitPrice = ({ line }: QuotationSavedLine) => {
    const baseline = line.discountSnapshot.baseUnitPrice;
    return promotion && isTradeDecimal(baseline) ? baseline : line.unitPrice;
  };
  const lineAmount = (entry: QuotationSavedLine) => multiplyFixedDecimal(entry.line.quantity, unitPrice(entry));

  return (
    <>
      <div className="hidden lg:block">
        <Table className="text-xs [&_th]:text-xs">
          <TableHeader className="bg-primary/5">
            <TableRow className="h-8 hover:bg-transparent">
              <TableHead scope="col" aria-label={t.common.rowNumber} className="h-8 w-9 px-2 py-1 text-center">{t.common.rowNumberShort}</TableHead>
              <TableHead aria-hidden="true" className="h-8 w-9 p-0" />
              <TableHead scope="col" className="h-8 w-[20%] min-w-36 px-2.5 py-1">
                {t.tradeDocuments.item}
              </TableHead>
              <TableHead scope="col" className="h-8 w-[30%] min-w-48 px-2.5 py-1">
                {descriptionLabel}
              </TableHead>
              <TableHead scope="col" className="h-8 w-24 px-2.5 py-1">
                {copy.unit}
              </TableHead>
              <TableHead scope="col" className="h-8 w-20 px-2.5 py-1 text-end">
                {copy.quantity}
              </TableHead>
              <TableHead scope="col" className="h-8 w-28 px-2.5 py-1 text-end">
                {copy.unitPrice}
              </TableHead>
              {showLineDiscount ? <TableHead scope="col" className="h-8 w-28 px-2.5 py-1 text-end">
                {t.quotationDiscount.lineDiscount}
              </TableHead> : null}
              <TableHead scope="col" className="h-8 w-28 px-2.5 py-1 text-end">
                {copy.lineAmount}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((entry) => {
              const display = lineDisplayById?.[entry.line.clientLineId];
              return (
                <TableRow key={entry.line.id} className="h-8 even:bg-primary/3 hover:bg-primary/5">
                  <TableCell className="w-9 px-2 py-0.5 text-center align-middle tabular-nums text-muted-foreground">
                    {formatNumber(entry.line.printLineNumber, lang)}
                  </TableCell>
                  <TableCell aria-hidden="true" className="w-9 px-1.5 py-0.5 align-middle">
                    <QuotationItemThumbnail item={entry.item} />
                  </TableCell>
                  <TableCell className="max-w-56 px-2.5 py-1 font-normal">
                    <SavedItem entry={entry} display={display} />
                  </TableCell>
                  <TableCell className="max-w-72 px-2.5 py-1 font-normal">
                    <SavedDescription text={entry.line.descriptionSnapshot} />
                  </TableCell>
                  <TableCell className="px-2.5 py-0.5 text-xs font-normal">
                    <SavedUnit entry={entry} display={display} />
                  </TableCell>
                  <TableCell className="px-2.5 py-0.5 text-end text-xs font-normal">
                    <Money value={entry.line.quantity} minimumFractionDigits={0} maximumFractionDigits={8} />
                  </TableCell>
                  <TableCell className="px-2.5 py-0.5 text-end text-xs font-normal">
                    <Money value={unitPrice(entry)} minimumFractionDigits={2} maximumFractionDigits={8} />
                  </TableCell>
                  {showLineDiscount ? <TableCell className="px-2.5 py-0.5 text-end text-xs font-normal">
                    <SavedDiscount entry={entry} />
                  </TableCell> : null}
                  <TableCell className="px-2.5 py-0.5 text-end text-xs font-normal">
                    <Money value={lineAmount(entry)} minimumFractionDigits={2} maximumFractionDigits={8} />
                  </TableCell>
                </TableRow>
              );
            })}
            {showDeduction ? <QuotationDeductionRow amount={discountAmount} currencyCode={currencyCode} promotion={promotion}
              labelColumns={showLineDiscount ? 8 : 7} /> : null}
          </TableBody>
        </Table>
      </div>
      <div className="divide-y divide-border lg:hidden">
        {lines.map((entry) => {
          const display = lineDisplayById?.[entry.line.clientLineId];
          return (
            <div key={entry.line.id} className="space-y-2.5 p-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatNumber(entry.line.printLineNumber, lang)}</span>
                <QuotationItemThumbnail item={entry.item} />
                <SavedItem entry={entry} display={display} />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs text-muted-foreground">{descriptionLabel}</p>
                <SavedDescription text={entry.line.descriptionSnapshot} />
              </div>
              <dl className="grid grid-cols-2 gap-2.5 text-sm">
                <div className="min-w-0 space-y-0.5">
                  <dt className="text-xs text-muted-foreground">{copy.unit}</dt>
                  <dd className="font-normal">
                    <SavedUnit entry={entry} display={display} />
                  </dd>
                </div>
                <div className="min-w-0 space-y-0.5 text-end">
                  <dt className="text-xs text-muted-foreground">{copy.quantity}</dt>
                  <dd className="font-normal">
                    <Money value={entry.line.quantity} minimumFractionDigits={0} maximumFractionDigits={8} />
                  </dd>
                </div>
                <div className="min-w-0 space-y-0.5">
                  <dt className="text-xs text-muted-foreground">{copy.unitPrice}</dt>
                  <dd className="font-normal">
                    <Money value={unitPrice(entry)} minimumFractionDigits={2} maximumFractionDigits={8} />
                  </dd>
                </div>
                {showLineDiscount ? <div className="min-w-0 space-y-0.5 text-end">
                  <dt className="text-xs text-muted-foreground">{t.quotationDiscount.lineDiscount}</dt>
                  <dd className="font-normal">
                    <SavedDiscount entry={entry} />
                  </dd>
                </div> : null}
                <div className="col-span-2 flex items-baseline justify-between gap-2 border-t border-border/70 pt-2">
                  <dt className="text-xs text-muted-foreground">{copy.lineAmount}</dt>
                  <dd className="font-normal">
                    <Money value={lineAmount(entry)} minimumFractionDigits={2} maximumFractionDigits={8} />
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
        {showDeduction ? <QuotationDeductionRow amount={discountAmount} currencyCode={currencyCode} promotion={promotion} /> : null}
      </div>
    </>
  );
}

function SavedDiscount({ entry }: { entry: QuotationSavedLine }) {
  const value = entry.line.discountTotal;
  if (compareFixedDecimal(value, "0") <= 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <Money value={`-${value}`} minimumFractionDigits={2} maximumFractionDigits={8} className="text-destructive" />;
}

function SavedItem({ entry, display }: { entry: QuotationSavedLine; display?: QuotationSavedLineDisplay }) {
  return <QuotationItemIdentity fallback={{
    itemName: entry.itemName ?? display?.itemName,
    sku: entry.sku ?? display?.sku,
    unavailable: entry.unavailable || Boolean(display?.unavailable),
  }} />;
}

function SavedDescription({ text }: { text: string }) {
  return text.trim() ? <bdi dir="auto" className="block text-xs leading-4 wrap-anywhere whitespace-pre-wrap text-foreground">{text}</bdi>
    : <span className="text-muted-foreground">—</span>;
}

function SavedUnit({
  entry,
  display,
}: {
  entry: QuotationSavedLine;
  display?: QuotationSavedLineDisplay;
}) {
  const { t } = useI18n();
  if (entry.unit) {
    return (
      <span>
        {entry.unit.displayName}
        {entry.unit.code !== entry.unit.displayName ? (
          <>
            {" "}
            <span className="text-xs text-muted-foreground">
              (<IdentifierText>{entry.unit.code}</IdentifierText>)
            </span>
          </>
        ) : null}
      </span>
    );
  }
  const uomCode = entry.uomCode ?? display?.uomCode?.trim() ?? null;
  if (uomCode) {
    return <IdentifierText>{uomCode}</IdentifierText>;
  }
  return <span className="text-muted-foreground">{t.tradeDocuments.notRecorded}</span>;
}
