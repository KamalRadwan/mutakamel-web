"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TradeGate } from "../../documents/components/TradeGate";
import { QUOTATION_PERMISSIONS } from "../quotation-contract";
import { QUOTATION_REPLACEMENT_PARAM } from "../quotation-composer-draft";
import { StandaloneQuotationWorkspace } from "./StandaloneQuotationWorkspace";

function QuotationWorkspaceRoute() {
  const sources = useSearchParams().getAll(QUOTATION_REPLACEMENT_PARAM);
  const replacementQuoteId = sources.length === 1 ? sources[0] : sources.length > 1 ? "" : undefined;
  return <StandaloneQuotationWorkspace key={replacementQuoteId ?? "new"} replacementQuoteId={replacementQuoteId} />;
}

export default function CreateQuotationStandalonePage() {
  return (
    <TradeGate require={QUOTATION_PERMISSIONS.create}>
      <Suspense><QuotationWorkspaceRoute /></Suspense>
    </TradeGate>
  );
}
