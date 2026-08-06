import { useState } from "react";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useToast } from "@/components/ui/ToastContext";
import { shouldRotateWriteCommandKey } from "@/shared/api/write-command-recovery";

export interface ActionMutationOptions<TResult> {
  onSuccessMessage?: string;
  onSuccess?: (result: TResult) => void | Promise<void>;
  /** Refetch authoritative state after a rejected or ambiguous command. */
  onErrorReconcile?: () => void | Promise<void>;
}

export function useActionMutation() {
  const toast = useToast();
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
        toast.success("Success", options.onSuccessMessage);
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
      toast.error("Error", normalized.message);
      throw normalized;
    } finally {
      setIsMutating(false);
    }
  };

  return { mutate, isMutating };
}
