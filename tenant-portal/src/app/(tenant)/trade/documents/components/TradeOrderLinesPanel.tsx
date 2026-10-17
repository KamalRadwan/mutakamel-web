"use client";

import { DataTable, DetailSection, Money, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useTradeTableLabels } from "../hooks/useTradeTableLabels";

interface TradeOrderLineSnapshot {
  id: string;
  printLineNumber: number | null;
  descriptionSnapshot: string | null;
  orderedQuantity: string;
  unitPrice: string;
  lineTotal: string;
  taxSnapshot: Record<string, unknown> | null;
}

interface TradeOrderLinesPanelProps<Line extends TradeOrderLineSnapshot> {
  lines: Line[];
  currencyCode: string;
  secondaryDescriptionLabel: string;
  secondaryDescription: (line: Line) => string | null;
  emptyTitle: string;
  errorTitle: string;
}

/** Read-only evidence captured with an order, never current catalogue values. */
export function TradeOrderLinesPanel<Line extends TradeOrderLineSnapshot>({
  lines,
  currencyCode,
  secondaryDescriptionLabel,
  secondaryDescription,
  emptyTitle,
  errorTitle,
}: TradeOrderLinesPanelProps<Line>) {
  const { t } = useI18n();
  const labels = useTradeTableLabels(emptyTitle, errorTitle);

  const columns: ColumnDef<Line>[] = [
    {
      id: "printLineNumber",
      header: t.common.rowNumberShort,
      numeric: true,
      cell: (line) => line.printLineNumber ?? t.tradeDocuments.notRecorded,
    },
    {
      id: "descriptionSnapshot",
      header: t.tradeDocuments.item,
      cell: (line) => (
        <div className="min-w-56">
          <p>{line.descriptionSnapshot ?? t.tradeDocuments.notRecorded}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{secondaryDescriptionLabel}:</span>{" "}
            {secondaryDescription(line) ?? t.tradeDocuments.notRecorded}
          </p>
        </div>
      ),
    },
    {
      id: "quantity",
      header: t.tradeDocuments.quantity,
      numeric: true,
      cell: (line) => (
        <Money
          value={line.orderedQuantity}
          minimumFractionDigits={0}
          maximumFractionDigits={8}
        />
      ),
    },
    {
      id: "unitPrice",
      header: t.tradeDocuments.unitPrice,
      numeric: true,
      cell: (line) => (
        <Money
          value={line.unitPrice}
          currency={currencyCode}
          minimumFractionDigits={2}
          maximumFractionDigits={8}
        />
      ),
    },
    {
      id: "taxSnapshot",
      header: t.tradeDocuments.taxEvidence,
      cell: (line) => (
        <TaxSnapshotDetails
          snapshot={line.taxSnapshot}
          label={t.tradeDocuments.taxEvidence}
          accessibleLabel={`${t.tradeDocuments.taxEvidence}: ${
            line.descriptionSnapshot ?? line.printLineNumber ?? t.tradeDocuments.notRecorded
          }`}
          emptyLabel={t.tradeDocuments.notRecorded}
        />
      ),
    },
    {
      id: "lineTotal",
      header: t.tradeDocuments.lineTotal,
      numeric: true,
      cell: (line) => (
        <Money
          value={line.lineTotal}
          currency={currencyCode}
          minimumFractionDigits={2}
          maximumFractionDigits={8}
        />
      ),
    },
  ];

  return (
    <DetailSection
      title={t.tradeDocuments.lines}
      emptyValueLabel={t.tradeDocuments.notRecorded}
      columns={1}
    >
      <DataTable
        columns={columns}
        rows={lines}
        rowKey={(line) => line.id}
        isLoading={false}
        labels={labels}
        density="compact"
        showRowNumbers={false}
      />
    </DetailSection>
  );
}

function TaxSnapshotDetails({
  snapshot,
  label,
  accessibleLabel,
  emptyLabel,
}: {
  snapshot: Record<string, unknown> | null;
  label: string;
  accessibleLabel: string;
  emptyLabel: string;
}) {
  if (snapshot === null) return emptyLabel;

  const taxCode =
    typeof snapshot.taxCode === "string"
      ? snapshot.taxCode
      : typeof snapshot.code === "string"
        ? snapshot.code
        : null;
  const rateBps =
    typeof snapshot.rateBps === "number"
      ? `${(snapshot.rateBps / 100).toFixed(2)}%`
      : typeof snapshot.ratePercent === "number"
        ? `${snapshot.ratePercent}%`
        : null;

  return (
    <div className="min-w-36 space-y-1">
      {taxCode || rateBps ? (
        <div className="flex flex-wrap items-center gap-1">
          {taxCode ? (
            <span className="dossier-tag dossier-tag-indigo">{taxCode}</span>
          ) : null}
          {rateBps ? (
            <span className="dossier-tag dossier-tag-emerald">{rateBps}</span>
          ) : null}
        </div>
      ) : null}
      <details>
        <summary
          aria-label={accessibleLabel}
          className="cursor-pointer rounded-sm py-1 text-xs text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {label}
        </summary>
        <pre
          aria-label={accessibleLabel}
          dir="ltr"
          className="mt-1 max-h-40 max-w-80 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-muted p-2 font-mono text-xs text-foreground"
        >
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      </details>
    </div>
  );
}
