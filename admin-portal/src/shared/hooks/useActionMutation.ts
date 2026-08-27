import { useState } from "react";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useToast } from "@/components/ui/ToastContext";
import { shouldRotateWriteCommandKey } from "@/shared/api/write-command-recovery";
import { useI18n } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";

interface ActionMutationOptions<TResult> {
  onSuccessMessage?: string;
  onSuccess?: (result: TResult) => void | Promise<void>;
  /** Refetch authoritative state after a rejected or ambiguous command. */
  onErrorReconcile?: () => void | Promise<void>;
}

export function useActionMutation() {
  const toast = useToast();
  const { lang } = useI18n();
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const [isMutating, setIsMutating] = useState(false);

  const mutate = async <TResult>(
    idempotencyPayload: unknown,
    action: (idempotencyKey: string) => Promise<TResult>,
    options?: ActionMutationOptions<TResult>
  ): Promise<TResult> => {
    setIsMutating(true);
    try {
      const key = getIdempotencyKey(idempotencyPayload);
      const result = await action(key);
      if (options?.onSuccessMessage) {
        toast.success(lang === "ar" ? ar.common.successTitle : en.common.successTitle, options.onSuccessMessage);
      }
      resetKey();
      if (options?.onSuccess) {
        await options.onSuccess(result);
      }
      return result;
    } catch (err) {
      const normalized = normalizeApiError(err);
      if (shouldRotateWriteCommandKey(normalized)) {
        resetKey();
      }
      if (options?.onErrorReconcile) {
        await options.onErrorReconcile();
      }
      toast.error(lang === "ar" ? ar.common.errorTitle : en.common.errorTitle, normalized.message);
      throw normalized;
    } finally {
      setIsMutating(false);
    }
  };

  return { mutate, isMutating };
}
