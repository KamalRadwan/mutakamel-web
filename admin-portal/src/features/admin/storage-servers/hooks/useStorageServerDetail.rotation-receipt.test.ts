// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, rotateMock, revokeMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  rotateMock: vi.fn(),
  revokeMock: vi.fn(),
}));
vi.mock("../api/storage-servers.api", () => ({
  storageServersApi: {
    get: getMock,
    rotateCredentials: rotateMock,
    revokeCredentialRotation: revokeMock,
  },
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin" }, isLoading: false }),
}));
vi.mock("@/lib/auth/rbac", () => ({
  adminCan: () => true,
  adminCanAll: () => true,
  ADMIN_RBAC_CRITICAL: {
    STORAGE_SERVERS_UPDATE: ["update"],
    STORAGE_SERVERS_DELETE: ["delete"],
  },
}));
vi.mock("@/shared/hooks/useIdempotency", () => ({
  useIdempotency: () => ({ getIdempotencyKey: () => "key", resetKey: vi.fn() }),
}));

import { useStorageServerDetail } from "./useStorageServerDetail";

const SERVER_ID = "019f0000-0000-7000-8000-000000000010";
const ROTATION_ID = "019f0000-0000-7000-8000-0000000000a1";
const NEW_SECRET = "s3cr3t-new-access-key-material";

function serverView() {
  return { id: SERVER_ID, name: "Primary", configRevision: 7 };
}

function rotationView(overrides: Record<string, unknown> = {}) {
  return {
    id: ROTATION_ID,
    storageServerId: SERVER_ID,
    expectedConfigRevision: 7,
    operationGeneration: "3",
    nextCredentialsRevision: 4,
    graceHours: 4,
    status: "ACTIVATED",
    stagedAt: "2026-09-05T08:00:00.000Z",
    activatedAt: "2026-09-05T08:00:05.000Z",
    graceExpiresAt: "2026-09-05T12:00:05.000Z",
    revokedAt: null,
    ...overrides,
  };
}

async function startRotation() {
  const hook = renderHook(() => useStorageServerDetail(SERVER_ID));
  await waitFor(() => expect(hook.result.current.server).toMatchObject({ id: SERVER_ID }));
  await act(async () => {
    await hook.result.current.rotateCredentials(
      { accessKeyId: "AKIA-NEW", secretAccessKey: NEW_SECRET },
      4,
    );
  });
  return hook;
}

describe("useStorageServerDetail rotation receipt", () => {
  beforeEach(() => {
    window.localStorage.clear();
    getMock.mockReset();
    rotateMock.mockReset();
    revokeMock.mockReset();
    getMock.mockResolvedValue(serverView());
    rotateMock.mockResolvedValue(rotationView());
    revokeMock.mockResolvedValue(rotationView({ status: "REVOKED", revokedAt: "2026-09-05T12:30:00.000Z" }));
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("still offers the revoke after the page is reloaded", async () => {
    // The grace window is hours long, so the operator cannot finish the
    // rotation in the sitting that started it. Core exposes no read route for
    // rotations, so the POST receipt was the only handle that existed — and it
    // lived in React state, which a reload throws away. The rotation then
    // stayed open with no way to complete it from the portal.
    const first = await startRotation();
    expect(first.result.current.currentRotation).toMatchObject({ rotationId: ROTATION_ID });
    first.unmount();

    // A reload: a brand new provider, nothing carried over in memory.
    const reloaded = renderHook(() => useStorageServerDetail(SERVER_ID));
    await waitFor(() =>
      expect(reloaded.result.current.currentRotation).toMatchObject({
        rotationId: ROTATION_ID,
        status: "ACTIVATED",
        graceExpiresAt: "2026-09-05T12:00:05.000Z",
      }),
    );

    await act(async () => {
      await reloaded.result.current.revokeCredentialRotation(
        reloaded.result.current.currentRotation!.rotationId,
      );
    });
    expect(revokeMock).toHaveBeenCalledWith(SERVER_ID, ROTATION_ID, "key");
  });

  it("keeps no key material in the browser", async () => {
    const hook = await startRotation();
    const stored = JSON.stringify(
      Object.fromEntries(
        Array.from({ length: window.localStorage.length }, (_, index) => {
          const key = window.localStorage.key(index) ?? "";
          return [key, window.localStorage.getItem(key)];
        }),
      ),
    );

    expect(stored).toContain(ROTATION_ID);
    expect(stored).not.toContain(NEW_SECRET);
    expect(stored).not.toContain("AKIA-NEW");
    hook.unmount();
  });

  it("puts the receipt down once the old key has been revoked", async () => {
    const hook = await startRotation();
    await act(async () => {
      await hook.result.current.revokeCredentialRotation(ROTATION_ID);
    });
    hook.unmount();

    const reloaded = renderHook(() => useStorageServerDetail(SERVER_ID));
    await waitFor(() => expect(reloaded.result.current.server).toMatchObject({ id: SERVER_ID }));
    expect(reloaded.result.current.currentRotation).toBeNull();
  });

  it("does not offer another server's rotation", async () => {
    const hook = await startRotation();
    hook.unmount();

    const other = renderHook(() =>
      useStorageServerDetail("019f0000-0000-7000-8000-000000000099"),
    );
    await waitFor(() => expect(other.result.current.server).not.toBeNull());
    expect(other.result.current.currentRotation).toBeNull();
  });
});
