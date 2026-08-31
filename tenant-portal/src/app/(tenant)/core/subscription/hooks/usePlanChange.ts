"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import {
  SUBSCRIPTION_SEATS_MAX,
  type SubscriptionItem,
} from "../subscription-contract";
import {
  applyPlanChangePreview,
  createSeatIncreasePreview,
  planChangeErrorKey,
  type PlanChangeApplied,
  type PlanChangePreview,
} from "../plan-change-contract";

export type PlanChangeStage = "form" | "preview";

/**
 * The two-step, add-or-increase-only plan change.
 *
 * Only a **seat increase on an existing item** is offered, because it is the
 * only plan change this portal can express against the API it has: `ADD`
 * additionally needs a module and a tier, and there is no tenant-facing
 * catalogue route to enumerate either (OPEN-QUESTIONS Q25). `REMOVE` and any
 * decrease are refused outright for a tenant actor with
 * `DOWNGRADE_NOT_ALLOWED`, so neither is offered and then apologised for.
 */
export function usePlanChange(onApplied: () => void) {
  const { t } = useI18n();
  const toast = useToast();

  const [item, setItem] = useState<SubscriptionItem | null>(null);
  const [seats, setSeats] = useState("");
  const [stage, setStage] = useState<PlanChangeStage>("form");
  const [preview, setPreview] = useState<PlanChangePreview | null>(null);
  const [applied, setApplied] = useState<PlanChangeApplied | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** Reused across a retry of the same apply, so a resend cannot double-charge. */
  const [applyKey, setApplyKey] = useState<string | null>(null);

  const describe = useCallback(
    (error: NormalizedApiError): string => {
      const key = planChangeErrorKey(error.code);
      return key ? t.coreBilling.planChangeErrors[key] : t.coreBilling.planChangeFailed;
    },
    [t],
  );

  const open = useCallback((target: SubscriptionItem) => {
    setItem(target);
    setSeats(String(target.seats + 1));
    setStage("form");
    setPreview(null);
    setFormError(null);
    setApplyKey(null);
  }, []);

  const close = useCallback(() => {
    if (isBusy) return;
    setItem(null);
    setPreview(null);
    setFormError(null);
  }, [isBusy]);

  const requestPreview = useCallback(async (): Promise<void> => {
    if (!item || isBusy) return;
    const parsed = Number(seats.trim());
    // A seat count is a UI-entered integer, not a wire decimal — this is the
    // one place a numeric conversion is correct, and it is bounded exactly as
    // `@IsInt() @Min(1) @Max(100000)` bounds it.
    if (!Number.isSafeInteger(parsed) || parsed <= item.seats || parsed > SUBSCRIPTION_SEATS_MAX) {
      setFormError(t.coreBilling.seatsMustIncrease);
      return;
    }
    setIsBusy(true);
    setFormError(null);
    try {
      const result = await createSeatIncreasePreview(item.id, parsed, generateUUIDv7());
      setPreview(result);
      setStage("preview");
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        setFormError(describe(normalized));
      }
    } finally {
      setIsBusy(false);
    }
  }, [item, isBusy, seats, t, toast, describe]);

  /**
   * `POST .../:previewId/apply` — 200, idempotency-required.
   *
   * A replay returns the stored result with `Idempotency-Replayed: true`. The
   * change applied once; reporting it as a duplicate would be wrong.
   */
  const applyPreview = useCallback(async (): Promise<boolean> => {
    if (!preview || isBusy) return false;
    const key = applyKey ?? generateUUIDv7();
    setApplyKey(key);
    setIsBusy(true);
    setFormError(null);
    try {
      const result = await applyPlanChangePreview(preview.previewId, key);
      setApplied(result);
      toast.success(
        t.coreBilling.planChangeAppliedTitle,
        result.replayed ? t.coreBilling.planChangeReplayed : t.coreBilling.planChangeApplied,
      );
      onApplied();
      return true;
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        setFormError(describe(normalized));
      }
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [preview, isBusy, applyKey, toast, t, onApplied, describe]);

  return {
    item,
    seats,
    setSeats,
    stage,
    preview,
    applied,
    dismissApplied: () => setApplied(null),
    isBusy,
    formError,
    open,
    close,
    requestPreview,
    applyPreview,
    backToForm: () => {
      setStage("form");
      setPreview(null);
      setFormError(null);
    },
  };
}
