"use client";

import { useState } from "react";
import { commercialRecoveryRequestSchema, type CommercialRecoveryRequest } from "../commercial-recovery";
import type { useCommercialChange } from "./useCommercialChange";

export function useCommercialRecoveryReview(change: ReturnType<typeof useCommercialChange>) {
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [review, setReview] = useState<{ operationId: string; request: CommercialRecoveryRequest } | null>(null);
  const operation = change.state?.operation;
  if (review && (!change.canRecover || review.operationId !== operation?.operationId || review.request.expectedOperationRevision !== operation.operationRevision)) setReview(null);
  const choose = (action: CommercialRecoveryRequest["action"]) => {
    if (!change.canRecover || !operation) return;
    const request = commercialRecoveryRequestSchema.safeParse({ expectedOperationRevision: operation.operationRevision, action, reason: reason.trim() });
    setInvalid(!request.success);
    if (request.success) setReview({ operationId: operation.operationId, request: request.data });
  };
  const confirm = async () => {
    if (!review || !change.canRecover || review.operationId !== operation?.operationId || review.request.expectedOperationRevision !== operation.operationRevision) return;
    await change.recover(review.request.action, review.request.reason);
    setReview(null);
  };
  return { reason, setReason, invalid, review, choose, confirm, close: () => setReview(null) };
}
