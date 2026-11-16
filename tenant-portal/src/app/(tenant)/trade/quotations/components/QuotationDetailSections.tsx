"use client";

import type { RefObject } from "react";
import { FileText, History } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/design-system";
import { RecordHistoryTab } from "@/components/audit/RecordHistoryTab";
import { useI18n } from "@/i18n/I18nContext";
import type { QuotationDetailWorkspaceState } from "../hooks/useQuotationDetailWorkspace";
import { QuotationPdfWorkspace } from "./QuotationPdfWorkspace";

export function QuotationDetailSections({ state, pdfTrigger, reopenPdfJobId }: {
  state: QuotationDetailWorkspaceState;
  pdfTrigger: RefObject<HTMLButtonElement | null>;
  reopenPdfJobId?: string;
}) {
  const { t } = useI18n();
  const { quotation } = state;
  return (
    <Accordion type="multiple" defaultValue={reopenPdfJobId ? ["pdf"] : undefined} className="rounded-lg border border-border bg-card px-3">
      <AccordionItem value="pdf" id="quotation-pdf-workspace">
        <AccordionTrigger ref={pdfTrigger} className="py-2.5 text-xs font-semibold">
          <span className="inline-flex items-center gap-2">
            <FileText className="size-3.5 text-primary" aria-hidden="true" />{t.quotationPdf.title}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-3">
          <QuotationPdfWorkspace quotation={quotation} headers={state.scopedHeaders} reopenJobId={reopenPdfJobId} compact />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="history" className="border-b-0">
        <AccordionTrigger className="py-2.5 text-xs font-semibold">
          <span className="inline-flex items-center gap-2">
            <History className="size-3.5 text-primary" aria-hidden="true" />{t.audit.historyTitle}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-3">
          <RecordHistoryTab density="compact" entityType="TradeQuotationEntity" entityId={quotation.id} relatedPartyIds={[quotation.partyId]} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
