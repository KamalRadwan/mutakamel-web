// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, getMock, patchMock, postMock, uuidMock } = vi.hoisted(() => ({
  authMock: {
    user: null as { isSuperAdmin: boolean; permissions: string[] } | null,
    isLoading: false,
  },
  getMock: vi.fn(),
  patchMock: vi.fn(),
  postMock: vi.fn(),
  uuidMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en" }) }));
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock, patch: patchMock, post: postMock },
}));
vi.mock("@/lib/utils/uuid", () => ({ generateUUIDv7: uuidMock }));

import { useSmtpSettings } from "./useSmtpSettings";

const TIMESTAMP = "2026-08-12T08:00:00.000Z";
const COMMAND_ID = "019f0000-0000-7000-8000-000000000001";

function envelope<T>(data: T, correlationId = "corr-smtp") {
  return { data: { success: true, data, correlationId, timestamp: TIMESTAMP } };
}

function config(revision = 1) {
  return {
    configured: true,
    revision,
    fromAddress: "notifications@example.com",
    fromName: "Mutakamel",
    senderDomain: "mail.example.com",
    smtpHost: "smtp.example.com",
    smtpPort: 465,
    smtpSecure: true,
    smtpProtocol: "smtps",
    smtpUsername: "mailer@example.com",
    smtpPasswordConfigured: true,
    updatedAt: TIMESTAMP,
  } as const;
}

function auditEnvelope() {
  return envelope([]);
}

describe("useSmtpSettings", () => {
  beforeEach(() => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: [
        "admin.settings.read",
        "admin.settings.update",
        "admin.settings.critical",
      ],
    };
    authMock.isLoading = false;
    getMock.mockReset().mockImplementation((url: string) =>
      url.endsWith("/audit") ? Promise.resolve(auditEnvelope()) : Promise.resolve(envelope(config())),
    );
    patchMock.mockReset();
    postMock.mockReset();
    uuidMock.mockReset().mockReturnValue(COMMAND_ID);
  });

  it("keeps SMTP state unknown until the authoritative read settles", async () => {
    let resolveConfig!: (value: unknown) => void;
    const pendingConfig = new Promise((resolve) => {
      resolveConfig = resolve;
    });
    getMock.mockImplementation((url: string) =>
      url.endsWith("/audit") ? Promise.resolve(auditEnvelope()) : pendingConfig,
    );
    const { result } = renderHook(() => useSmtpSettings());
    expect(result.current.configState).toBe("LOADING");
    expect(result.current.form).toBeNull();
    resolveConfig(envelope(config()));
    await waitFor(() => expect(result.current.configState).toBe("READY"));
    expect(result.current.form?.smtpPort).toBe("465");
  });

  it("enforces ALL update+critical semantics inside the mutation hook", async () => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: ["admin.settings.read", "admin.settings.update"],
    };
    const { result } = renderHook(() => useSmtpSettings());
    await waitFor(() => expect(result.current.configState).toBe("READY"));
    expect(result.current.canSaveCritical).toBe(false);
    act(() => result.current.handleUpdate("smtpHost", "other.example.com"));
    expect(result.current.form?.smtpHost).toBe("smtp.example.com");
    await act(async () => {
      expect(await result.current.saveConfig()).toBe(false);
    });
    expect(patchMock).not.toHaveBeenCalled();
  });

  it("blocks testing dirty form values, then tests only after a saved response reconciles", async () => {
    patchMock.mockResolvedValue(envelope({ ...config(2), smtpHost: "new.example.com" }, "corr-saved"));
    postMock.mockResolvedValue(envelope({ verified: true }, "corr-verified"));
    const { result } = renderHook(() => useSmtpSettings());
    await waitFor(() => expect(result.current.configState).toBe("READY"));

    act(() => result.current.handleUpdate("smtpHost", "new.example.com"));
    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.canTestSavedConfig).toBe(false);
    await act(async () => {
      expect(await result.current.verifyConnection()).toBe(false);
    });
    expect(postMock).not.toHaveBeenCalled();

    await act(async () => {
      expect(await result.current.saveConfig()).toBe(true);
    });
    expect(patchMock.mock.calls[0][1]).toEqual({ smtpHost: "new.example.com" });
    expect(patchMock.mock.calls[0][2]).toEqual({
      headers: { "x-idempotency-key": COMMAND_ID },
    });
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.canTestSavedConfig).toBe(true);

    await act(async () => {
      expect(await result.current.verifyConnection()).toBe(true);
    });
    expect(postMock.mock.calls[0]).toEqual([
      "/api/admin/core/v1/system-settings/email/verify-connection",
      undefined,
      { headers: { "x-idempotency-key": COMMAND_ID } },
    ]);
  });

  it("renders forbidden/unavailable distinctly and never fabricates a config", async () => {
    authMock.user = { isSuperAdmin: false, permissions: [] };
    const { result, rerender } = renderHook(() => useSmtpSettings());
    await waitFor(() => expect(result.current.configState).toBe("FORBIDDEN"));
    expect(result.current.form).toBeNull();
    expect(getMock).not.toHaveBeenCalled();

    authMock.user = {
      isSuperAdmin: false,
      permissions: ["admin.settings.read"],
    };
    getMock.mockImplementation((url: string) =>
      url.endsWith("/audit")
        ? Promise.resolve(auditEnvelope())
        : Promise.reject({
            isNormalized: true,
            httpStatus: 503,
            errorCode: "CORE_DOWN",
            message: "raw",
          }),
    );
    rerender();
    await waitFor(() => expect(result.current.configState).toBe("UNAVAILABLE"));
    expect(result.current.form).toBeNull();
  });
});
