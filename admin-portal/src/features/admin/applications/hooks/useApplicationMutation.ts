import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useActionMutation } from "@/shared/hooks/useActionMutation";
import { localizeApplicationError } from "../lib/application-error-copy";

/** Localize before the shared mutation emits its failure toast. */
export function useApplicationMutation() {
  const { t } = useI18n();
  const mutation = useActionMutation();
  const mutate = <TResult,>(
    payload: unknown,
    action: (key: string) => Promise<TResult>,
    options?: {
      onSuccessMessage?: string;
      onSuccess?: (result: TResult) => void | Promise<void>;
      onErrorReconcile?: () => void | Promise<void>;
    },
  ) => mutation.mutate(payload, async (key) => {
    try {
      return await action(key);
    } catch (error) {
      throw { ...normalizeApiError(error), message: localizeApplicationError(error, t) };
    }
  }, options);
  return { ...mutation, mutate };
}
