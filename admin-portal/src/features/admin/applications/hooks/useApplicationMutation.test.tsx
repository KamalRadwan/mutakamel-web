// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { useApplicationMutation } from "./useApplicationMutation";

const state = vi.hoisted(() => ({
  lang: "ar" as "ar" | "en", resetKey: vi.fn(), error: vi.fn(),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: state.lang, t: state.lang === "ar" ? ar : en }),
}));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => ({ error: state.error }) }));
vi.mock("@/shared/hooks/useIdempotency", () => ({
  useIdempotency: () => ({ getIdempotencyKey: () => "original-intent", resetKey: state.resetKey }),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("catalogue mutation error presentation", () => {
  it.each(["ar", "en"] as const)("localizes failure toasts in %s while preserving retry metadata", async (lang) => {
    state.lang = lang;
    const t = lang === "ar" ? ar : en;
    const { result } = renderHook(() => useApplicationMutation());
    for (const failure of [
      { isNormalized: true as const, httpStatus: 409, errorCode: "APPLICATION_CATALOGUE_REVISION_STALE", message: "English server copy", correlationId: "request-123" },
      { isNormalized: true as const, httpStatus: 409, errorCode: "APPLICATION_CATALOGUE_REVISION_STALE", message: "English server copy", correlationId: "request-123", requestOutcome: "settled-before-session-change" as const },
    ]) {
      state.resetKey.mockClear();
      const reconcile = vi.fn();
      const action = vi.fn().mockRejectedValue(failure);
      await act(async () => {
        await expect(result.current.mutate({ operation: "PUBLISH" }, action, { onErrorReconcile: reconcile }))
          .rejects.toMatchObject({ ...failure, message: expect.stringContaining(t.applications.errors.APPLICATION_CATALOGUE_REVISION_STALE) });
      });
      expect(action).toHaveBeenCalledWith("original-intent");
      expect(reconcile).toHaveBeenCalledOnce();
      expect(state.resetKey).toHaveBeenCalledTimes(failure.requestOutcome ? 0 : 1);
      expect(state.error).toHaveBeenLastCalledWith(t.common.errorTitle, expect.stringContaining("\u2066request-123\u2069"));
    }
  });
});
