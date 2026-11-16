import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { isAmbiguousWriteOutcome } from "@/shared/api/write-command-recovery";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { applicationsApi } from "../api/applications.api";
import { templateDesignerPolicy } from "../lib/core-base-feature-policy";
import type { CoreBaseFeaturePolicyReceipt, FeatureView } from "../types";

interface Intent {
  policy: CoreBaseFeaturePolicyReceipt;
  included: boolean;
  key: string;
}

export interface TemplateDesignerBasePolicyProps {
  applicationId: string;
  feature: FeatureView;
  canMutate: boolean;
  onRefresh: () => Promise<{ features: FeatureView[] } | null>;
}

export function useTemplateDesignerBasePolicy({ applicationId, feature, canMutate, onRefresh }: TemplateDesignerBasePolicyProps) {
  const { t } = useI18n();
  const copy = t.applications.baseFeaturePolicy;
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const policy = templateDesignerPolicy(feature, applicationId);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [failure, setFailure] = useState<NormalizedApiError | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const submitting = useRef(false);
  const dispatchedIntentKey = useRef<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const context = useRef({ applicationId, featureId: feature.id });
  const [stateContext, setStateContext] = useState(`${applicationId}:${feature.id}`);
  const currentContext = stateContext === `${applicationId}:${feature.id}`;

  useEffect(() => {
    context.current = { applicationId, featureId: feature.id };
    submitting.current = false;
    dispatchedIntentKey.current = null;
    queueMicrotask(() => {
      setStateContext(`${applicationId}:${feature.id}`); setIsSubmitting(false); setIsRefreshing(false);
      setIntent(null); setIsOpen(false); setFailure(null); setNeedsRefresh(false); setStatus(null);
      resetKey();
    });
  }, [applicationId, feature.id, resetKey]);

  useEffect(() => {
    if (failure && isOpen) errorRef.current?.focus();
  }, [failure, isOpen]);

  const errorMessage = failure
    ? failure.httpStatus === 403 ? copy.forbidden
      : failure.errorCode === "CORE_BASE_FEATURE_REVISION_STALE" ? copy.stale
        : failure.errorCode === "CORE_BASE_FEATURE_NOT_ELIGIBLE" ? copy.notEligible
          : isAmbiguousWriteOutcome(failure) ? copy.unknown
            : copy.failed
    : null;

  const requestChange = () => {
    if (!canMutate || !policy || !currentContext || submitting.current) return;
    if (intent) { setIsOpen(true); return; }
    const included = !policy.baseIncluded;
    const body = { basePolicy: { expectedBaseGrantRevision: policy.baseGrantRevision, included } };
    setIntent({ policy, included, key: getIdempotencyKey({ applicationId, featureId: feature.id, body }) });
    setFailure(null); setNeedsRefresh(false); setStatus(null); setIsOpen(true);
  };

  const refresh = async () => {
    if (submitting.current || isRefreshing) return;
    setIsRefreshing(true);
    const requested = context.current;
    try {
      const snapshot = await onRefresh();
      if (context.current !== requested) return;
      const next = templateDesignerPolicy(snapshot?.features.find((row) => row.id === feature.id), applicationId);
      if (!next) { setStatus(copy.unavailable); return; }
      if (intent && failure && isAmbiguousWriteOutcome(failure) && next.baseGrantRevision === intent.policy.baseGrantRevision) {
        // A read can precede an in-flight commit. Only an exact retry is safe.
        setNeedsRefresh(false);
        return;
      }
      resetKey(); setIntent(null); setIsOpen(false); setFailure(null); setNeedsRefresh(false); setStatus(copy.refreshed);
    } catch {
      if (context.current === requested) setStatus(copy.refreshFailed);
    } finally {
      if (context.current === requested) setIsRefreshing(false);
    }
  };

  const submit = async () => {
    if (!intent || !canMutate || !policy || !currentContext || submitting.current || needsRefresh) return;
    if (policy.id !== intent.policy.id || policy.baseGrantRevision !== intent.policy.baseGrantRevision
      || policy.baseIncluded !== intent.policy.baseIncluded) {
      setFailure({ isNormalized: true, httpStatus: 409, errorCode: "CORE_BASE_FEATURE_REVISION_STALE", message: copy.stale });
      setNeedsRefresh(true);
      return;
    }
    submitting.current = true;
    dispatchedIntentKey.current = intent.key;
    setIsSubmitting(true); setFailure(null); setStatus(null);
    const requested = context.current;
    try {
      const receipt = await applicationsApi.updateCoreBaseFeaturePolicy(policy.id, {
        basePolicy: { expectedBaseGrantRevision: intent.policy.baseGrantRevision, included: intent.included },
      }, intent.key);
      if (receipt.moduleId !== applicationId || receipt.baseGrantRevision !== intent.policy.baseGrantRevision + 1) {
        throw new Error("Invalid Core base feature policy receipt");
      }
      if (context.current !== requested) return;
      resetKey(); setIntent(null); setIsOpen(false); setNeedsRefresh(false); setStatus(copy.saved);
    } catch (error) {
      if (context.current !== requested) return;
      const normalized = normalizeApiError(error);
      setFailure(normalized);
      setNeedsRefresh(!isAmbiguousWriteOutcome(normalized));
    } finally {
      if (context.current === requested) {
        // Never infer current policy from a metadata checkbox or an optimistic row.
        await onRefresh().catch(() => null);
        if (context.current === requested) {
          submitting.current = false; setIsSubmitting(false);
        }
      }
    }
  };

  return {
    policy, intent, isOpen: isOpen && currentContext, isSubmitting, isRefreshing,
    errorMessage, failure, status, errorRef, needsRefresh,
    canChange: canMutate && Boolean(policy) && currentContext,
    requestChange, submit, refresh,
    close: () => {
      if (submitting.current) return;
      setIsOpen(false);
      if (intent && dispatchedIntentKey.current !== intent.key) {
        // Dismissing a confirmation before any write discards that draft.
        // A dispatched command retains its identity for outcome recovery.
        resetKey(); setIntent(null); setFailure(null); setNeedsRefresh(false);
      }
    },
  };
}
