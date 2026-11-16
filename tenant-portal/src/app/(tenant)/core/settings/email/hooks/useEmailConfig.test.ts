// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import {
  EMAIL_CONFIG_PATH,
  EMAIL_CONFIG_VERIFY_CONNECTION_PATH,
  EMAIL_CONFIG_VERIFY_PATH,
  NOT_READY_CODE,
  PRECONDITION_REQUIRED_CODE,
  SMTP_CONNECTION_FAILED_CODE,
  STALE_REVISION_CODE,
  VERIFICATION_FAILED_CODE,
} from "../email-config-contract";
import { useEmailConfig } from "./useEmailConfig";

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  canManage: true,
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  },
  coreGet: vi.fn(),
  corePatch: vi.fn(),
  corePost: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  outcomeFromApi: vi.fn(() => false),
}));

vi.mock("next/navigation", () => ({ useRouter: () => state.router }));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: state.lang,
    dir: ({ en: "ltr", ar: "rtl" } as const)[state.lang],
    t: ({ en, ar })[state.lang],
    setLang: vi.fn(),
    toggleLang: vi.fn(),
  }),
}));

vi.mock("@/design-system", async () => ({
  ...(await import("@/design-system/feedback/format-api-error")),
  useCan: () => state.canManage,
  useToast: () => ({
    success: state.toastSuccess,
    error: state.toastError,
    warning: vi.fn(),
    info: vi.fn(),
    errorFromApi: vi.fn(),
    outcomeFromApi: state.outcomeFromApi,
  }),
}));

vi.mock("../../../core-api", () => ({
  coreGet: (...args: unknown[]) => state.coreGet(...args),
  corePatch: (...args: unknown[]) => state.corePatch(...args),
  corePost: (...args: unknown[]) => state.corePost(...args),
}));

const basePayload = {
  revision: 4,
  fromAddress: "support@acme.example",
  fromName: "Acme Support",
  replyTo: null,
  senderDomain: "acme.example",
  providerDriver: "smtp",
  credentialsMode: "TENANT_ENCRYPTED_SMTP",
  providerCredentialsConfigured: true,
  providerCredentialsVersion: 2,
  providerCredentialsRefFingerprint: null,
  smtpHost: "smtp.acme.example",
  smtpPort: 587,
  smtpSecure: true,
  smtpProtocol: "smtp",
  smtpUsername: "mailer",
  smtpPasswordConfigured: true,
  feedbackProfile: "CRM_FEEDBACK_V1",
  dkimSelector: "s1",
  dkimVerified: true,
  verifiedAt: "2026-10-20T09:00:00.000Z",
  planDailyQuota: 2000,
  planRateLimitPerMin: 120,
  planQuotaRevision: 3,
  dailyQuota: 500,
  rateLimitPerMin: 30,
  effectiveDailyQuota: 500,
  effectiveRateLimitPerMin: 30,
  status: "ACTIVE",
  updatedAt: "2026-10-20T09:05:00.000Z",
};

function apiError(status: number, data: Record<string, unknown>): TenantApiClientError {
  return new TenantApiClientError("request failed", {
    status,
    statusText: "Error",
    headers: new Headers(),
    data,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.lang = "en";
  state.canManage = true;
  state.outcomeFromApi.mockReturnValue(false);
  state.coreGet.mockResolvedValue({ data: basePayload, headers: new Headers({ ETag: '"9"' }) });
});

describe("useEmailConfig", () => {
  it("distinguishes a malformed HTTP 200 response from an offline request", async () => {
    state.coreGet.mockResolvedValueOnce({ data: {}, headers: new Headers() });
    const { result } = renderHook(useEmailConfig);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasLoadError).toBe(true);
    expect(result.current.loadErrorMessage).toBe(en.coreSettings.invalidResponseDescription);
    expect(result.current.config).toBeNull();
    expect(result.current.revision).toBeNull();
  });

  it("aborts manual reloads on unmount even when the transport completes late", async () => {
    const { result, unmount } = renderHook(useEmailConfig);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let signal: AbortSignal | undefined;
    let complete!: (value: unknown) => void;
    state.coreGet.mockImplementationOnce((_path, options) => {
      signal = options.signal;
      return new Promise((resolve) => {
        complete = resolve;
      });
    });
    act(() => result.current.reload());
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      complete({ data: basePayload, headers: new Headers() });
    });
  });

  it("reads strong ETag revision, enforces synchronous write fence against duplicate calls, and sends If-Match on save", async () => {
    let resolveSave!: (value: { data: typeof basePayload; headers: Headers }) => void;
    state.corePatch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );

    const { result } = renderHook(() => useEmailConfig());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.revision).toBe(9);
    expect(result.current.config?.planDailyQuota).toBe(2000);
    expect(result.current.draft?.smtpPassword).toBe("");

    act(() => {
      result.current.openModal("sender");
      result.current.updateDraft({ fromName: "Acme Desk", smtpPassword: "fresh-secret-value" });
    });
    expect(result.current.isDirty).toBe(true);

    let savePromise!: Promise<void>;
    act(() => {
      savePromise = result.current.save();
      // Synchronous second save/verify/probe in the same tick before rerender must be fenced.
      void result.current.save();
      void result.current.verify();
      void result.current.verifyConnection();
    });
    expect(state.corePatch).toHaveBeenCalledTimes(1);
    expect(state.corePost).not.toHaveBeenCalled();
    expect(result.current.pending).toBe("save");

    act(() => {
      result.current.discardDraft();
      result.current.reload();
    });
    expect(result.current.isDiscardOpen).toBe(false);
    expect(state.coreGet).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave({
        data: { ...basePayload, revision: 10, fromName: "Acme Desk" },
        headers: new Headers({ ETag: '"10"' }),
      });
      await savePromise;
    });

    expect(state.corePatch).toHaveBeenCalledWith(
      EMAIL_CONFIG_PATH,
      {
        fromName: "Acme Desk",
        smtpPassword: "fresh-secret-value",
        smtpSecure: true,
        smtpProtocol: "smtp",
      },
      expect.objectContaining({ headers: { "If-Match": '"9"' } }),
    );
    expect(result.current.revision).toBe(10);
    expect(result.current.activeModal).toBeNull();
    expect(result.current.draft?.smtpPassword).toBe("");
    expect(result.current.isDirty).toBe(false);
    expect(state.toastSuccess).toHaveBeenCalledWith(
      en.coreSettings.savedTitle,
      en.coreSettings.emailSaved,
    );
  });

  it("validates fields inline and transitions from Sender modal to SMTP modal when SMTP fields are invalid", async () => {
    state.coreGet.mockResolvedValueOnce({
      data: {
        ...basePayload,
        providerDriver: "platform-shared",
        smtpHost: null,
        smtpPort: null,
        smtpUsername: null,
        smtpPasswordConfigured: false,
      },
      headers: new Headers({ ETag: '"9"' }),
    });
    const { result } = renderHook(() => useEmailConfig());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openModal("sender");
      result.current.updateDraft({ providerDriver: "smtp" });
    });
    expect(result.current.activeModal).toBe("sender");

    await act(async () => {
      await result.current.save();
    });

    expect(state.corePatch).not.toHaveBeenCalled();
    expect(result.current.activeModal).toBe("smtp");
    expect(result.current.fieldErrors).toEqual({
      smtpHost: en.coreSettings.emailFormSmtpHost,
      smtpPort: en.coreSettings.emailFormSmtpPort,
      smtpUsername: en.coreSettings.emailFormSmtpUsername,
      smtpPassword: en.coreSettings.emailSmtpPasswordRequired,
    });

    act(() => result.current.updateDraft({ providerDriver: "platform-shared" }));
    expect(result.current.fieldErrors).toEqual({});
  });

  it("refuses verify and verifyConnection network calls when draft is dirty or saved provider is not SMTP", async () => {
    const { result } = renderHook(() => useEmailConfig());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.updateDraft({ fromName: "Dirty Draft" }));
    await act(async () => {
      await result.current.verify();
      await result.current.verifyConnection();
    });
    expect(state.corePost).not.toHaveBeenCalled();

    state.coreGet.mockResolvedValueOnce({
      data: { ...basePayload, providerDriver: "platform-shared" },
      headers: new Headers({ ETag: '"11"' }),
    });
    const shared = renderHook(() => useEmailConfig());
    await waitFor(() => expect(shared.result.current.isLoading).toBe(false));

    await act(async () => {
      await shared.result.current.verifyConnection();
    });
    expect(state.corePost).not.toHaveBeenCalled();
  });

  it("supports concise status-only suspension kill-switch and blocks activation without verified DKIM", async () => {
    const { result } = renderHook(() => useEmailConfig());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    state.corePatch.mockResolvedValueOnce({
      data: { ...basePayload, revision: 10, status: "SUSPENDED", dkimVerified: false },
      headers: new Headers({ ETag: '"10"' }),
    });
    await act(async () => {
      await result.current.setDeliveryStatus("SUSPENDED");
    });
    expect(state.corePatch).toHaveBeenCalledWith(
      EMAIL_CONFIG_PATH,
      { status: "SUSPENDED" },
      expect.objectContaining({ headers: { "If-Match": '"9"' } }),
    );
    expect(result.current.config?.status).toBe("SUSPENDED");

    // Cannot activate when dkimVerified is false.
    await act(async () => {
      await result.current.setDeliveryStatus("ACTIVE");
    });
    expect(state.corePatch).toHaveBeenCalledTimes(1);
  });

  it("preserves draft and baseline on 409, fetches latest into review state, adopts revision explicitly, and requires a separate save", async () => {
    const { result } = renderHook(() => useEmailConfig());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openModal("sender");
      result.current.updateDraft({ fromName: "My Preserved Draft", smtpPassword: "kept-password" });
    });

    state.corePatch.mockRejectedValueOnce(
      apiError(409, { errorCode: STALE_REVISION_CODE, correlationId: "c-409" }),
    );
    await act(async () => {
      await result.current.save();
    });

    expect(result.current.conflict).toBe("staleRevision");
    expect(result.current.conflictReview).toBeNull();
    expect(result.current.activeModal).toBeNull();
    expect(result.current.draft?.fromName).toBe("My Preserved Draft");
    expect(result.current.draft?.smtpPassword).toBe("kept-password");
    expect(result.current.baseline?.fromName).toBe("Acme Support");

    // Save is blocked while conflict is unresolved.
    await act(async () => {
      await result.current.save();
    });
    expect(state.corePatch).toHaveBeenCalledTimes(1);

    state.coreGet.mockResolvedValueOnce({
      data: {
        ...basePayload,
        revision: 12,
        fromName: "Server Concurrent Name",
        replyTo: "ops@acme.example",
      },
      headers: new Headers({ ETag: '"12"' }),
    });
    await act(async () => {
      await result.current.resolveConflict();
    });

    // Draft and baseline remain preserved during review; no auto-retry PATCH!
    expect(state.corePatch).toHaveBeenCalledTimes(1);
    expect(result.current.conflict).toBe("staleRevision");
    expect(result.current.conflictReview?.latestRevision).toBe(12);
    expect(result.current.conflictReview?.diffRows.map((row) => row.key)).toEqual([
      "fromName",
      "replyTo",
      "smtpPassword",
    ]);
    expect(result.current.draft?.fromName).toBe("My Preserved Draft");
    expect(result.current.baseline?.fromName).toBe("Acme Support");

    // Explicit adoption updates baseline + revision and merges unedited server replyTo, without saving yet.
    act(() => result.current.adoptConflictLatest());
    expect(state.corePatch).toHaveBeenCalledTimes(1);
    expect(result.current.conflict).toBeNull();
    expect(result.current.conflictReview).toBeNull();
    expect(result.current.revision).toBe(12);
    expect(result.current.activeModal).toBe("sender");
    expect(result.current.draft?.fromName).toBe("My Preserved Draft");
    expect(result.current.draft?.replyTo).toBe("ops@acme.example");
    expect(result.current.draft?.smtpPassword).toBe("kept-password");

    // Separate deliberate save now uses If-Match: "12" and sends only user's delta.
    state.corePatch.mockResolvedValueOnce({
      data: {
        ...basePayload,
        revision: 13,
        fromName: "My Preserved Draft",
        replyTo: "ops@acme.example",
      },
      headers: new Headers({ ETag: '"13"' }),
    });
    await act(async () => {
      await result.current.save();
    });
    expect(state.corePatch).toHaveBeenCalledTimes(2);
    expect(state.corePatch).toHaveBeenLastCalledWith(
      EMAIL_CONFIG_PATH,
      {
        fromName: "My Preserved Draft",
        smtpPassword: "kept-password",
        smtpSecure: true,
        smtpProtocol: "smtp",
      },
      expect.objectContaining({ headers: { "If-Match": '"12"' } }),
    );
  });

  it("keeps 428 distinct from 409 and refreshes precondition without wiping an unchanged server's draft", async () => {
    const { result } = renderHook(() => useEmailConfig());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.updateDraft({ fromName: "Edited Before 428" }));
    state.corePatch.mockRejectedValueOnce(
      apiError(428, { errorCode: PRECONDITION_REQUIRED_CODE, correlationId: "c-428" }),
    );
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.conflict).toBe("preconditionRequired");
    expect(state.toastError).not.toHaveBeenCalled();

    state.coreGet.mockResolvedValueOnce({
      data: { ...basePayload, revision: 11 },
      headers: new Headers({ ETag: '"11"' }),
    });
    await act(async () => {
      await result.current.resolveConflict();
    });
    expect(result.current.conflict).toBeNull();
    expect(result.current.revision).toBe(11);
    expect(result.current.draft?.fromName).toBe("Edited Before 428");
  });

  it("guards dirty discard and reload, retains draft on cancel, and runs immediately when clean", async () => {
    const { result } = renderHook(() => useEmailConfig());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(state.coreGet).toHaveBeenCalledTimes(1);

    act(() => result.current.reload());
    await waitFor(() => expect(state.coreGet).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isDiscardOpen).toBe(false);

    act(() => result.current.updateDraft({ fromName: "Unsaved Sender" }));
    act(() => result.current.discardDraft());
    expect(result.current.isDiscardOpen).toBe(true);
    expect(result.current.draft?.fromName).toBe("Unsaved Sender");

    act(() => result.current.cancelDiscard());
    expect(result.current.isDiscardOpen).toBe(false);
    expect(result.current.draft?.fromName).toBe("Unsaved Sender");

    act(() => result.current.discardDraft());
    act(() => result.current.confirmDiscard());
    expect(result.current.isDirty).toBe(false);
    expect(result.current.draft?.fromName).toBe("Acme Support");
  });

  it.each(["en", "ar"] as const)(
    "runs verify and SMTP probe with localized error guidance in %s",
    async (lang) => {
      state.lang = lang;
      const t = ({ en, ar })[lang];
      const { result } = renderHook(() => useEmailConfig());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      state.corePost.mockRejectedValueOnce(
        apiError(422, {
          errorCode: VERIFICATION_FAILED_CODE,
          message: "DNS TXT mismatch",
          correlationId: "v-1",
        }),
      );
      await act(async () => {
        await result.current.verify();
      });
      expect(state.corePost).toHaveBeenCalledWith(
        EMAIL_CONFIG_VERIFY_PATH,
        undefined,
        expect.objectContaining({ headers: { "If-Match": '"9"' } }),
      );
      expect(result.current.formError).toContain(t.coreSettings.emailVerificationFailed);
      expect(result.current.formError).toContain("v-1");
      expect(result.current.formError).not.toContain("DNS TXT mismatch");

      state.corePost.mockRejectedValueOnce(
        apiError(422, {
          errorCode: SMTP_CONNECTION_FAILED_CODE,
          message: "ECONNREFUSED",
          correlationId: "p-1",
        }),
      );
      await act(async () => {
        await result.current.verifyConnection();
      });
      expect(state.corePost).toHaveBeenCalledWith(
        EMAIL_CONFIG_VERIFY_CONNECTION_PATH,
        undefined,
        expect.objectContaining({ maxResponseBytes: 10_000 }),
      );
      expect(result.current.formError).toContain(t.coreSettings.emailSmtpConnectionFailed);
      expect(result.current.probeOutcome?.status).toBe("failed");
      expect(result.current.formError).not.toContain("ECONNREFUSED");
    },
  );

  it("distinguishes NOT_READY, ACCESS_POLICY_BLOCKED, and 403 forbidden on load", async () => {
    state.coreGet.mockRejectedValueOnce(apiError(503, { errorCode: NOT_READY_CODE }));
    const first = renderHook(() => useEmailConfig());
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(first.result.current.isNotReady).toBe(true);
    expect(first.result.current.loadError).toBeNull();

    state.coreGet.mockRejectedValueOnce(apiError(403, { errorCode: "ACCESS_POLICY_BLOCKED" }));
    const second = renderHook(() => useEmailConfig());
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));
    expect(second.result.current.isAccessBlocked).toBe(true);
    expect(second.result.current.isForbidden).toBe(false);

    state.coreGet.mockRejectedValueOnce(apiError(403, { errorCode: "FORBIDDEN" }));
    const third = renderHook(() => useEmailConfig());
    await waitFor(() => expect(third.result.current.isLoading).toBe(false));
    expect(third.result.current.isForbidden).toBe(true);
    expect(third.result.current.loadError).toBeNull();
  });

  it("aborts and ignores a deferred latest-review GET on reset, scope disposal, or unmount while preserving draft and baseline without auto-writing", async () => {
    const { result, rerender, unmount } = renderHook(() => useEmailConfig());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.updateDraft({
        fromName: "Preserved Conflict Draft",
        smtpPassword: "draft-password",
      });
    });

    state.corePatch.mockRejectedValueOnce(
      apiError(409, { errorCode: STALE_REVISION_CODE, correlationId: "c-409-abort" }),
    );
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.conflict).toBe("staleRevision");
    expect(state.corePatch).toHaveBeenCalledTimes(1);

    // 1. Deferred latest-review GET -> explicit resetConflict -> signal aborted & late resolve ignored.
    let resolveFirstLatest!: (value: { data: unknown; headers: Headers }) => void;
    let firstSignal: AbortSignal | undefined;
    state.coreGet.mockImplementationOnce(
      (_path: string, config?: { signal?: AbortSignal }) =>
        new Promise((resolve) => {
          firstSignal = config?.signal;
          resolveFirstLatest = resolve;
        }),
    );

    let firstPromise!: Promise<void>;
    act(() => {
      firstPromise = result.current.resolveConflict();
    });
    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal?.aborted).toBe(false);
    expect(result.current.isConflictLoading).toBe(true);

    act(() => {
      result.current.resetConflict();
    });
    expect(firstSignal?.aborted).toBe(true);
    expect(result.current.conflict).toBeNull();
    expect(result.current.isConflictLoading).toBe(false);
    expect(result.current.draft?.fromName).toBe("Preserved Conflict Draft");
    expect(result.current.draft?.smtpPassword).toBe("draft-password");
    expect(result.current.baseline?.fromName).toBe("Acme Support");

    await act(async () => {
      resolveFirstLatest({
        data: { ...basePayload, revision: 21, fromName: "Ignored Late Server Name" },
        headers: new Headers({ ETag: '"21"' }),
      });
      await firstPromise;
    });
    expect(result.current.conflictReview).toBeNull();
    expect(result.current.revision).toBe(9);
    expect(result.current.draft?.fromName).toBe("Preserved Conflict Draft");
    expect(result.current.baseline?.fromName).toBe("Acme Support");
    expect(state.toastError).not.toHaveBeenCalled();
    expect(state.corePatch).toHaveBeenCalledTimes(1);

    // 2. Re-trigger 409 -> deferred latest-review GET -> manage-scope disposal (canManage -> false) -> aborted & late reject ignored.
    state.corePatch.mockRejectedValueOnce(
      apiError(409, { errorCode: STALE_REVISION_CODE, correlationId: "c-409-scope" }),
    );
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.conflict).toBe("staleRevision");
    expect(state.corePatch).toHaveBeenCalledTimes(2);

    let rejectScopeLatest!: (reason?: unknown) => void;
    let scopeSignal: AbortSignal | undefined;
    state.coreGet.mockImplementationOnce(
      (_path: string, config?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          scopeSignal = config?.signal;
          rejectScopeLatest = reject;
        }),
    );

    let scopePromise!: Promise<void>;
    act(() => {
      scopePromise = result.current.resolveConflict();
    });
    expect(scopeSignal?.aborted).toBe(false);

    state.canManage = false;
    rerender();
    expect(scopeSignal?.aborted).toBe(true);
    expect(result.current.conflict).toBeNull();
    expect(result.current.draft?.fromName).toBe("Preserved Conflict Draft");
    expect(result.current.baseline?.fromName).toBe("Acme Support");

    await act(async () => {
      rejectScopeLatest(apiError(500, { errorCode: "INTERNAL_ERROR" }));
      await scopePromise;
    });
    expect(state.toastError).not.toHaveBeenCalled();
    expect(result.current.formError).toBeNull();
    expect(state.corePatch).toHaveBeenCalledTimes(2);

    // 3. Re-enable manage -> 409 -> deferred latest-review GET -> unmount -> signal aborted & late resolve/reject ignored.
    state.canManage = true;
    rerender();
    state.corePatch.mockRejectedValueOnce(
      apiError(409, { errorCode: STALE_REVISION_CODE, correlationId: "c-409-unmount" }),
    );
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.conflict).toBe("staleRevision");
    expect(state.corePatch).toHaveBeenCalledTimes(3);

    let resolveUnmountedLatest!: (value: { data: unknown; headers: Headers }) => void;
    let unmountSignal: AbortSignal | undefined;
    state.coreGet.mockImplementationOnce(
      (_path: string, config?: { signal?: AbortSignal }) =>
        new Promise((resolve) => {
          unmountSignal = config?.signal;
          resolveUnmountedLatest = resolve;
        }),
    );

    let unmountPromise!: Promise<void>;
    act(() => {
      unmountPromise = result.current.resolveConflict();
    });
    expect(unmountSignal?.aborted).toBe(false);

    unmount();
    expect(unmountSignal?.aborted).toBe(true);

    await act(async () => {
      resolveUnmountedLatest({
        data: { ...basePayload, revision: 30, fromName: "After Unmount Server" },
        headers: new Headers({ ETag: '"30"' }),
      });
      await unmountPromise;
    });
    expect(result.current.conflictReview).toBeNull();
    expect(result.current.revision).toBe(9);
    expect(result.current.draft?.fromName).toBe("Preserved Conflict Draft");
    expect(result.current.baseline?.fromName).toBe("Acme Support");
    expect(state.toastError).not.toHaveBeenCalled();
    expect(state.toastSuccess).not.toHaveBeenCalled();
    expect(state.corePatch).toHaveBeenCalledTimes(3);
  });

  it("handles ordinary fetch errors vs 403 forbidden, ACCESS_POLICY_BLOCKED, and NOT_READY during latest-review GET", async () => {
    const triggerConflict = async () => {
      const hook = renderHook(() => useEmailConfig());
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
      act(() => hook.result.current.updateDraft({ fromName: "Draft Before Latest Review" }));
      state.corePatch.mockRejectedValueOnce(
        apiError(409, { errorCode: STALE_REVISION_CODE, correlationId: "c-409" }),
      );
      await act(async () => {
        await hook.result.current.save();
      });
      expect(hook.result.current.conflict).toBe("staleRevision");
      return hook;
    };

    // 1. Ordinary 500 error retains draft, baseline, and conflict while surfacing localized error + toast.
    const ordinary = await triggerConflict();
    state.coreGet.mockRejectedValueOnce(
      apiError(500, { errorCode: "UNEXPECTED_FAILURE", message: "Raw SQL error", correlationId: "r-500" }),
    );
    await act(async () => {
      await ordinary.result.current.resolveConflict();
    });
    expect(ordinary.result.current.conflict).toBe("staleRevision");
    expect(ordinary.result.current.draft?.fromName).toBe("Draft Before Latest Review");
    expect(ordinary.result.current.baseline?.fromName).toBe("Acme Support");
    expect(ordinary.result.current.formError).toContain(en.coreSettings.emailLoadFailed);
    expect(ordinary.result.current.formError).toContain("r-500");
    expect(ordinary.result.current.formError).not.toContain("Raw SQL error");
    expect(state.toastError).toHaveBeenCalledWith(
      en.coreSettings.emailLoadFailed,
      expect.stringContaining("r-500"),
    );
    ordinary.unmount();

    // 2. 403 FORBIDDEN on latest-review GET (suppressForbiddenToast: true) renders truthful isForbidden and clears private config.
    vi.clearAllMocks();
    state.coreGet.mockResolvedValueOnce({ data: basePayload, headers: new Headers({ ETag: '"9"' }) });
    const forbidden = await triggerConflict();
    state.coreGet.mockRejectedValueOnce(apiError(403, { errorCode: "FORBIDDEN", correlationId: "r-403" }));
    await act(async () => {
      await forbidden.result.current.resolveConflict();
    });
    expect(state.coreGet).toHaveBeenLastCalledWith(
      EMAIL_CONFIG_PATH,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        suppressForbiddenToast: true,
        maxResponseBytes: 40_000,
      }),
    );
    expect(forbidden.result.current.isForbidden).toBe(true);
    expect(forbidden.result.current.isAccessBlocked).toBe(false);
    expect(forbidden.result.current.isNotReady).toBe(false);
    expect(forbidden.result.current.hasLoadError).toBe(false);
    expect(forbidden.result.current.conflict).toBeNull();
    expect(forbidden.result.current.config).toBeNull();
    expect(forbidden.result.current.draft).toBeNull();
    expect(state.toastSuccess).not.toHaveBeenCalled();
    forbidden.unmount();

    // 3. 403 ACCESS_POLICY_BLOCKED stays distinct from generic 403 and NOT_READY.
    vi.clearAllMocks();
    state.coreGet.mockResolvedValueOnce({ data: basePayload, headers: new Headers({ ETag: '"9"' }) });
    const policyBlocked = await triggerConflict();
    state.coreGet.mockRejectedValueOnce(apiError(403, { errorCode: "ACCESS_POLICY_BLOCKED" }));
    await act(async () => {
      await policyBlocked.result.current.resolveConflict();
    });
    expect(policyBlocked.result.current.isAccessBlocked).toBe(true);
    expect(policyBlocked.result.current.isForbidden).toBe(false);
    expect(policyBlocked.result.current.isNotReady).toBe(false);
    expect(policyBlocked.result.current.conflict).toBeNull();
    expect(policyBlocked.result.current.config).toBeNull();
    policyBlocked.unmount();

    // 4. NOT_READY stays distinct from 403 and ACCESS_POLICY_BLOCKED.
    vi.clearAllMocks();
    state.coreGet.mockResolvedValueOnce({ data: basePayload, headers: new Headers({ ETag: '"9"' }) });
    const notReady = await triggerConflict();
    state.coreGet.mockRejectedValueOnce(apiError(503, { errorCode: NOT_READY_CODE }));
    await act(async () => {
      await notReady.result.current.resolveConflict();
    });
    expect(notReady.result.current.isNotReady).toBe(true);
    expect(notReady.result.current.isForbidden).toBe(false);
    expect(notReady.result.current.isAccessBlocked).toBe(false);
    expect(notReady.result.current.conflict).toBeNull();
    expect(notReady.result.current.config).toBeNull();
    notReady.unmount();
  });

  it("preserves over-cap quota drafts on 409 latest adoption, flags inline errors against lowered plan caps without clamping or auto-saving, and saves nullable overrides cleanly", async () => {
    const { result } = renderHook(() => useEmailConfig());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openModal("limits");
      result.current.updateDraft({ dailyQuota: "1500", rateLimitPerMin: "" });
    });

    state.corePatch.mockRejectedValueOnce(
      apiError(409, { errorCode: STALE_REVISION_CODE, correlationId: "c-409-quota" }),
    );
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.conflict).toBe("staleRevision");
    expect(result.current.draft?.dailyQuota).toBe("1500");

    // Concurrent plan downgrade lowers planDailyQuota from 2000 to 1000.
    state.coreGet.mockResolvedValueOnce({
      data: {
        ...basePayload,
        revision: 14,
        planDailyQuota: 1000,
        planQuotaRevision: 4,
        dailyQuota: 500,
        effectiveDailyQuota: 500,
      },
      headers: new Headers({ ETag: '"14"' }),
    });
    await act(async () => {
      await result.current.resolveConflict();
    });
    expect(state.corePatch).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.adoptConflictLatest();
    });
    expect(state.corePatch).toHaveBeenCalledTimes(1);
    expect(result.current.conflict).toBeNull();
    expect(result.current.revision).toBe(14);
    expect(result.current.config?.planDailyQuota).toBe(1000);
    // Preserves 1500 without clamping and surfaces inline error in limits modal.
    expect(result.current.draft?.dailyQuota).toBe("1500");
    expect(result.current.activeModal).toBe("limits");
    expect(result.current.fieldErrors.dailyQuota).toContain("1,000");

    // Attempting to save while over cap is blocked before network.
    await act(async () => {
      await result.current.save();
    });
    expect(state.corePatch).toHaveBeenCalledTimes(1);

    // Resetting dailyQuota to inherit plan ("") clears field error and sends null delta with If-Match "14".
    act(() => {
      result.current.updateDraft({ dailyQuota: "" });
    });
    expect(result.current.fieldErrors.dailyQuota).toBeUndefined();

    state.corePatch.mockResolvedValueOnce({
      data: {
        ...basePayload,
        revision: 15,
        planDailyQuota: 1000,
        planQuotaRevision: 4,
        dailyQuota: null,
        rateLimitPerMin: null,
        effectiveDailyQuota: 1000,
        effectiveRateLimitPerMin: 120,
      },
      headers: new Headers({ ETag: '"15"' }),
    });
    await act(async () => {
      await result.current.save();
    });
    expect(state.corePatch).toHaveBeenCalledTimes(2);
    expect(state.corePatch).toHaveBeenLastCalledWith(
      EMAIL_CONFIG_PATH,
      {
        dailyQuota: null,
        rateLimitPerMin: null,
        smtpSecure: true,
        smtpProtocol: "smtp",
      },
      expect.objectContaining({ headers: { "If-Match": '"14"' } }),
    );
    expect(result.current.config?.dailyQuota).toBeNull();
    expect(result.current.config?.rateLimitPerMin).toBeNull();
  });

  it("opens the centered probe modal on verifyConnection, records succeeded outcome, and clears outcome when returning to SMTP settings", async () => {
    const { result } = renderHook(() => useEmailConfig());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openModal("smtp");
    });
    expect(result.current.activeModal).toBe("smtp");

    state.corePost.mockResolvedValueOnce({ data: { verified: true }, headers: new Headers() });
    await act(async () => {
      await result.current.verifyConnection();
    });

    expect(result.current.activeModal).toBe("probe");
    expect(result.current.probeOutcome).toEqual({
      status: "succeeded",
      message: en.coreSettings.emailProbeMessage,
    });

    act(() => {
      result.current.openModal("smtp");
    });
    expect(result.current.activeModal).toBe("smtp");
    expect(result.current.probeOutcome).toBeNull();
  });
});
