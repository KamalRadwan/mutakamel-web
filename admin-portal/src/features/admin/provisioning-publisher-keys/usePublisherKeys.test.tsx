// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePublisherKeys } from "./usePublisherKeys";
import {
  ACTIVE_KEY,
  CHALLENGE,
  CHALLENGE_ID,
  CORRELATION_ID,
  IDEMPOTENCY_KEY,
  PUBLIC_KEY,
  PUBLISHER_KEY_ID,
  SIGNATURE,
} from "./test-fixtures";

const {
  authMock,
  listMock,
  getMock,
  challengeMock,
  registerMock,
  revokeMock,
  uuidMock,
} = vi.hoisted(() => ({
  authMock: {
    user: {
      id: "019f1000-0000-7000-8000-000000000099",
      permissions: [
        "admin.provisioning.publisher-keys.read",
        "admin.provisioning.publisher-keys.manage",
        "admin.provisioning.critical",
      ],
    },
    isLoading: false,
  },
  listMock: vi.fn(),
  getMock: vi.fn(),
  challengeMock: vi.fn(),
  registerMock: vi.fn(),
  revokeMock: vi.fn(),
  uuidMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/lib/utils/uuid", () => ({ generateUUIDv7: uuidMock }));
vi.mock("./api", () => ({
  publisherKeysApi: {
    list: listMock,
    get: getMock,
    createChallenge: challengeMock,
    register: registerMock,
    revoke: revokeMock,
  },
}));

const listResult = {
  data: [ACTIVE_KEY],
  correlationId: CORRELATION_ID,
  timestamp: "2026-08-12T12:00:01.000Z",
};
const keyResult = {
  data: ACTIVE_KEY,
  correlationId: CORRELATION_ID,
  timestamp: "2026-08-12T12:00:01.000Z",
};
const challengeResult = {
  data: CHALLENGE,
  correlationId: CORRELATION_ID,
  timestamp: "2026-08-12T12:00:01.000Z",
};

describe("usePublisherKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.user = {
      id: "019f1000-0000-7000-8000-000000000099",
      permissions: [
        "admin.provisioning.publisher-keys.read",
        "admin.provisioning.publisher-keys.manage",
        "admin.provisioning.critical",
      ],
    };
    authMock.isLoading = false;
    listMock.mockResolvedValue(listResult);
    getMock.mockResolvedValue(keyResult);
    challengeMock.mockResolvedValue(challengeResult);
    registerMock.mockResolvedValue(keyResult);
    revokeMock.mockResolvedValue({
      ...keyResult,
      data: {
        ...ACTIVE_KEY,
        status: "REVOKED",
        revision: 2,
        revokedAt: "2026-08-12T12:30:00.000Z",
        revocationReasonCode: "KEY_ROTATED",
      },
    });
    uuidMock.mockReturnValue(IDEMPOTENCY_KEY);
  });

  it("fails directory reads closed without the read permission", () => {
    authMock.user = {
      ...authMock.user,
      permissions: ["admin.provisioning.publisher-keys.manage"],
    };
    const { result } = renderHook(() => usePublisherKeys());

    expect(result.current.directory.state).toBe("FORBIDDEN");
    expect(result.current.directory.data).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
    expect(result.current.permissions.canManage).toBe(true);
  });

  it("loads the directory and reaches the selected-key GET", async () => {
    const { result } = renderHook(() => usePublisherKeys());
    await waitFor(() => expect(result.current.directory.state).toBe("READY"));

    act(() => result.current.selectKey(PUBLISHER_KEY_ID));
    await waitFor(() => expect(result.current.detail.state).toBe("READY"));

    expect(listMock).toHaveBeenCalledOnce();
    expect(getMock).toHaveBeenCalledWith(PUBLISHER_KEY_ID, expect.any(AbortSignal));
    expect(result.current.detail.correlationId).toBe(CORRELATION_ID);
  });

  it("retains the exact challenge body and UUIDv7 across an ambiguous retry", async () => {
    challengeMock
      .mockRejectedValueOnce({
        response: {
          status: 503,
          data: {
            type: "about:blank",
            title: "Unavailable",
            status: 503,
            code: "GW.UPSTREAM_UNAVAILABLE",
            correlationId: CORRELATION_ID,
          },
        },
      })
      .mockResolvedValueOnce(challengeResult);
    const { result } = renderHook(() => usePublisherKeys());
    await waitFor(() => expect(result.current.directory.state).toBe("READY"));

    act(() => {
      result.current.setChallengeDraftField("keyId", "core-release-primary");
      result.current.setChallengeDraftField("publicKeyBase64", PUBLIC_KEY);
      result.current.setChallengeDraftField("expiresInSeconds", "300");
    });
    act(() => expect(result.current.requestChallenge()).toBe(true));
    await waitFor(() => expect(result.current.mutation.state).toBe("AMBIGUOUS"));

    act(() => result.current.retryExactMutation());
    await waitFor(() => expect(result.current.mutation.state).toBe("SUCCESS"));

    expect(challengeMock).toHaveBeenCalledTimes(2);
    expect(challengeMock.mock.calls[0]).toEqual(challengeMock.mock.calls[1]);
    expect(challengeMock.mock.calls[0][1]).toBe(IDEMPOTENCY_KEY);
    expect(uuidMock).toHaveBeenCalledOnce();
    expect(result.current.registerDraft.challengeId).toBe(CHALLENGE_ID);
    expect(result.current.challengeResult?.data).toEqual(CHALLENGE);
  });

  it("keeps manage-only challenge permission separate from critical registration", async () => {
    authMock.user = {
      ...authMock.user,
      permissions: [
        "admin.provisioning.publisher-keys.read",
        "admin.provisioning.publisher-keys.manage",
      ],
    };
    const { result } = renderHook(() => usePublisherKeys());
    await waitFor(() => expect(result.current.directory.state).toBe("READY"));

    act(() => {
      result.current.setRegisterDraftField("challengeId", CHALLENGE_ID);
      result.current.setRegisterDraftField("proofSignatureBase64", SIGNATURE);
    });
    act(() => expect(result.current.requestRegister()).toBe(false));

    expect(result.current.permissions.canManage).toBe(true);
    expect(result.current.permissions.canRegisterOrRevoke).toBe(false);
    expect(result.current.mutation.state).toBe("FORBIDDEN");
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("allows the exact revoke contract without adding a read-permission dependency", async () => {
    authMock.user = {
      ...authMock.user,
      permissions: [
        "admin.provisioning.publisher-keys.manage",
        "admin.provisioning.critical",
      ],
    };
    const { result } = renderHook(() => usePublisherKeys());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.directory.state).toBe("FORBIDDEN");
    act(() => {
      result.current.setRevokeDraftField("publisherKeyId", PUBLISHER_KEY_ID);
      result.current.setRevokeDraftField("expectedRevision", "1");
      result.current.setRevokeDraftField("reasonCode", "KEY_ROTATED");
    });

    act(() => expect(result.current.requestRevoke()).toBe(true));
    act(() => result.current.confirmMutation());
    await waitFor(() => expect(result.current.mutation.state).toBe("SUCCESS"));

    expect(getMock).not.toHaveBeenCalled();
    expect(revokeMock).toHaveBeenCalledWith(
      PUBLISHER_KEY_ID,
      {
        expectedRevision: 1,
        expectedStatus: "ACTIVE",
        reasonCode: "KEY_ROTATED",
      },
      IDEMPOTENCY_KEY,
    );
  });

  it("confirmation-gates the critical registration and submits the exact DTO", async () => {
    const { result } = renderHook(() => usePublisherKeys());
    await waitFor(() => expect(result.current.directory.state).toBe("READY"));
    act(() => {
      result.current.setRegisterDraftField("challengeId", CHALLENGE_ID);
      result.current.setRegisterDraftField("proofSignatureBase64", SIGNATURE);
    });

    act(() => expect(result.current.requestRegister()).toBe(true));
    expect(result.current.mutation.state).toBe("CONFIRMING_REGISTER");
    expect(registerMock).not.toHaveBeenCalled();

    act(() => result.current.confirmMutation());
    await waitFor(() => expect(result.current.mutation.state).toBe("SUCCESS"));
    expect(registerMock).toHaveBeenCalledWith(
      { challengeId: CHALLENGE_ID, proofSignatureBase64: SIGNATURE },
      IDEMPOTENCY_KEY,
    );
  });

  it("retries an ambiguous critical registration with the exact retained intent", async () => {
    registerMock
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(keyResult);
    const { result } = renderHook(() => usePublisherKeys());
    await waitFor(() => expect(result.current.directory.state).toBe("READY"));
    act(() => {
      result.current.setRegisterDraftField("challengeId", CHALLENGE_ID);
      result.current.setRegisterDraftField("proofSignatureBase64", SIGNATURE);
    });
    act(() => result.current.requestRegister());
    act(() => result.current.confirmMutation());
    await waitFor(() => expect(result.current.mutation.state).toBe("AMBIGUOUS"));

    act(() => result.current.retryExactMutation());
    await waitFor(() => expect(result.current.mutation.state).toBe("SUCCESS"));

    expect(registerMock).toHaveBeenCalledTimes(2);
    expect(registerMock.mock.calls[0]).toEqual(registerMock.mock.calls[1]);
    expect(registerMock.mock.calls[0][1]).toBe(IDEMPOTENCY_KEY);
    expect(uuidMock).toHaveBeenCalledOnce();
  });

  it("confirmation-gates revision-fenced revocation", async () => {
    const { result } = renderHook(() => usePublisherKeys());
    await waitFor(() => expect(result.current.directory.state).toBe("READY"));
    act(() => result.current.selectKey(PUBLISHER_KEY_ID));
    await waitFor(() => expect(result.current.detail.state).toBe("READY"));
    act(() =>
      result.current.setRevokeDraftField("reasonCode", "KEY_ROTATED"),
    );

    act(() => expect(result.current.requestRevoke()).toBe(true));
    expect(result.current.mutation.state).toBe("CONFIRMING_REVOKE");
    expect(revokeMock).not.toHaveBeenCalled();

    act(() => result.current.confirmMutation());
    await waitFor(() => expect(result.current.mutation.state).toBe("SUCCESS"));
    expect(revokeMock).toHaveBeenCalledWith(
      PUBLISHER_KEY_ID,
      {
        expectedRevision: 1,
        expectedStatus: "ACTIVE",
        reasonCode: "KEY_ROTATED",
      },
      IDEMPOTENCY_KEY,
    );
  });
});
