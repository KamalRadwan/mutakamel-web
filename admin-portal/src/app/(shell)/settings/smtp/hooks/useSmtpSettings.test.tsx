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

  it("retries one probe on the same configuration, and never on a newer one", async () => {
    const KEY_FIRST_PROBE = "019f0000-0000-7000-8000-0000000000a1";
    const KEY_SAVE = "019f0000-0000-7000-8000-0000000000a2";
    const KEY_SECOND_PROBE = "019f0000-0000-7000-8000-0000000000a3";
    const issued = [KEY_FIRST_PROBE, KEY_SAVE, KEY_SECOND_PROBE];
    let nextKey = 0;
    uuidMock.mockReset().mockImplementation(() => issued[nextKey++] ?? "exhausted");

    const unreachable = {
      isNormalized: true,
      httpStatus: 503,
      errorCode: "CORE_DOWN",
      message: "raw",
    };
    postMock.mockRejectedValue(unreachable);
    patchMock.mockResolvedValue(
      envelope(
        {
          ...config(2),
          smtpHost: "new.example.com",
          updatedAt: "2026-08-12T09:00:00.000Z",
        },
        "corr-saved",
      ),
    );

    const { result } = renderHook(() => useSmtpSettings());
    await waitFor(() => expect(result.current.configState).toBe("READY"));

    // Ambiguous: the probe may have run and been committed. Its key is kept so
    // an immediate retry reconciles with that same probe rather than issuing a
    // second one against the same configuration.
    await act(async () => {
      expect(await result.current.verifyConnection()).toBe(false);
    });
    await act(async () => {
      expect(await result.current.verifyConnection()).toBe(false);
    });
    expect(postMock).toHaveBeenCalledTimes(2);
    expect(postMock.mock.calls[0][2].headers["x-idempotency-key"]).toBe(
      KEY_FIRST_PROBE,
    );
    expect(postMock.mock.calls[1][2].headers["x-idempotency-key"]).toBe(
      KEY_FIRST_PROBE,
    );

    // A new revision is now the saved configuration.
    act(() => result.current.handleUpdate("smtpHost", "new.example.com"));
    await act(async () => {
      expect(await result.current.saveConfig()).toBe(true);
    });
    expect(patchMock.mock.calls[0][2].headers["x-idempotency-key"]).toBe(KEY_SAVE);
    expect(result.current.snapshot?.data.revision).toBe(2);

    // The verification request carries no body, so the key is the only thing
    // telling the Gateway which configuration is being probed. Reusing the old
    // one would let it replay revision 1's stored `{verified:true}` and show
    // success for revision 2 without ever contacting the SMTP host.
    postMock.mockResolvedValue(envelope({ verified: true }, "corr-verified"));
    await act(async () => {
      expect(await result.current.verifyConnection()).toBe(true);
    });
    expect(postMock).toHaveBeenCalledTimes(3);
    expect(postMock.mock.calls[2][2].headers["x-idempotency-key"]).toBe(
      KEY_SECOND_PROBE,
    );
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
