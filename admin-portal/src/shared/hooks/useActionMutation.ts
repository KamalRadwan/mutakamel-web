import { useState } from "react";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useToast } from "@/components/ui/ToastContext";

export interface ActionMutationOptions<TResult> {
  onSuccessMessage?: string;
  onSuccess?: (result: TResult) => void;
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
        options.onSuccess(result);
      }
      return result;
    } catch (err) {
      const normalized = normalizeApiError(err);
      toast.error("Error", normalized.message);
      throw normalized;
    } finally {
      setIsMutating(false);
    }
  };

  return { mutate, isMutating };
}
