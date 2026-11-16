"use client";

import { useState } from "react";
import type { QuotationComposerState } from "./useQuotationComposer";

export function useQuotationDialogs(composer: QuotationComposerState) {
  const [issueOpen, setIssueOpen] = useState(false);
  return { issueOpen, setIssueOpen,
    confirmIssue: async () => { await composer.sendSaved(); setIssueOpen(false); },
  };
}

export function useQuotationCustomerPicker() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
