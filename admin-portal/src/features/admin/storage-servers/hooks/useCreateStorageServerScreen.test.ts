// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateStorageServerScreen } from "./useCreateStorageServerScreen";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  createServer: vi.fn(),
  activateServer: vi.fn(),
  createKey: vi.fn(() => "create-key"),
  activationKey: vi.fn(() => "activation-key"),
  resetCreateKey: vi.fn(),
  resetActivationKey: vi.fn(),
  idempotencyCall: 0,
  permissions: {
    read: true,
    create: true,
    activate: false,
    configureRuntime: true,
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/components/ui/ToastContext", () => ({
  useToast: () => ({
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
    error: vi.fn(),
  }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin-1" }, isLoading: false }),
}));

vi.mock("@/lib/auth/rbac", () => ({
  ADMIN_RBAC_CRITICAL: {
    STORAGE_SERVERS_CREATE: ["storage-create"],
    STORAGE_SERVERS_UPDATE: ["storage-activate"],
  },
  adminCan: (_user: unknown, permission: string) =>
    permission === "admin.storage_servers.read" && mocks.permissions.read,
  adminCanAll: (_user: unknown, permissions: string[]) =>
    permissions[0] === "storage-create"
      ? mocks.permissions.create
      : permissions[0] === "storage-activate"
        ? mocks.permissions.activate
        : mocks.permissions.configureRuntime,
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "en",
    dir: "ltr",
    t: {
      createStorageServer: {
        errors: {
          endpointHttpsOnly: "Enter an HTTPS root origin only.",
          registrationFailed: "Registration failed.",
        },
        success: {
          title: "Storage Server Registered",
          message: "Stored encrypted.",
        },
      },
    },
  }),
}));

vi.mock("@/shared/hooks/useIdempotency", () => ({
  useIdempotency: () => {
    const isCreateIntent = mocks.idempotencyCall++ % 2 === 0;
    return isCreateIntent
      ? {
          getIdempotencyKey: mocks.createKey,
          resetKey: mocks.resetCreateKey,
        }
      : {
          getIdempotencyKey: mocks.activationKey,
          resetKey: mocks.resetActivationKey,
        };
  },
}));

vi.mock("../api/storage-servers.api", () => ({
  storageServersApi: {
    create: mocks.createServer,
    activate: mocks.activateServer,
  },
}));

describe("useCreateStorageServerScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.idempotencyCall = 0;
    mocks.permissions.read = true;
    mocks.permissions.create = true;
    mocks.permissions.activate = false;
    mocks.permissions.configureRuntime = true;
  });

  it("initializes with registration permissions and an empty form", () => {
    const { result } = renderHook(() => useCreateStorageServerScreen());

    expect(result.current.isAuthLoading).toBe(false);
    expect(result.current.canCreate).toBe(true);
    expect(result.current.canActivate).toBe(false);
    expect(result.current.form.name).toBe("");
    expect(result.current.formError).toBeNull();
  });

  it("rejects a non-HTTPS endpoint before creating a server", async () => {
    const { result } = renderHook(() => useCreateStorageServerScreen());
    act(() => {
      result.current.setForm({
        ...result.current.form,
        name: "Test Garage",
        code: "garage-test",
        endpoint: "http://insecure.endpoint.com",
      });
    });

    await submit(result.current.handleSubmit);

    expect(result.current.formError).toBe("Enter an HTTPS root origin only.");
    expect(mocks.createServer).not.toHaveBeenCalled();
  });

  it("creates a DRAFT without activation for a create-only actor", async () => {
    mocks.createServer.mockResolvedValueOnce({ id: "stg-123" });
    const { result } = renderHook(() => useCreateStorageServerScreen());
    setValidForm(result.current);

    await submit(result.current.handleSubmit);

    expect(mocks.createServer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Garage Primary",
        code: "garage-primary",
        endpoint: "https://garage.example.com",
      }),
      "create-key",
    );
    expect(mocks.activateServer).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith("/storage-servers/stg-123");
  });

  it("guides the operator to Storage settings when the runtime key is unavailable", async () => {
    mocks.createServer.mockRejectedValueOnce({
      isNormalized: true,
      httpStatus: 503,
      errorCode: "CORE.STORAGE.RUNTIME_KEY_UNAVAILABLE",
      message: "The storage runtime key is unavailable.",
      correlationId: "runtime-correlation-1",
    });
    const { result } = renderHook(() => useCreateStorageServerScreen());
    setValidForm(result.current);

    await submit(result.current.handleSubmit);

    expect(result.current.formError).toBeNull();
    expect(result.current.canConfigureStorageRuntime).toBe(true);
    expect(result.current.storageRuntimeSetupRequired).toEqual({
      errorCode: "CORE.STORAGE.RUNTIME_KEY_UNAVAILABLE",
      correlationId: "runtime-correlation-1",
    });
    expect(mocks.resetCreateKey).not.toHaveBeenCalled();
  });

  it("resets the create intent after the definitive runtime-not-configured rejection", async () => {
    mocks.permissions.configureRuntime = false;
    mocks.createServer.mockRejectedValueOnce({
      isNormalized: true,
      httpStatus: 409,
      errorCode: "CORE.STORAGE_RUNTIME.NOT_CONFIGURED",
      message: "Configure the storage runtime before registering credentials.",
      correlationId: "runtime-correlation-2",
    });
    const { result } = renderHook(() => useCreateStorageServerScreen());
    setValidForm(result.current);

    await submit(result.current.handleSubmit);

    expect(result.current.canConfigureStorageRuntime).toBe(false);
    expect(result.current.storageRuntimeSetupRequired).toEqual({
      errorCode: "CORE.STORAGE_RUNTIME.NOT_CONFIGURED",
      correlationId: "runtime-correlation-2",
    });
    expect(mocks.resetCreateKey).toHaveBeenCalledTimes(1);
  });

  it("keeps activation-only recovery after a definitive failure without read access", async () => {
    mocks.permissions.read = false;
    mocks.permissions.activate = true;
    mocks.createServer.mockResolvedValueOnce({ id: "stg-456" });
    mocks.activateServer
      .mockRejectedValueOnce({
        isNormalized: true,
        httpStatus: 409,
        errorCode: "STORAGE_SERVER_CONNECTION_TEST_FAILED",
        message: "Connection rejected.",
      })
      .mockResolvedValueOnce({ id: "stg-456", status: "ACTIVE" });
    mocks.activationKey
      .mockReturnValueOnce("activation-key-1")
      .mockReturnValueOnce("activation-key-2");

    const { result } = renderHook(() => useCreateStorageServerScreen());
    setValidForm(result.current);
    await submit(result.current.handleSubmit);

    expect(result.current.setupPending).toBe(true);
    expect(result.current.formError).toBe("Connection rejected.");
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.resetActivationKey).toHaveBeenCalledTimes(1);

    await submit(result.current.handleSubmit);

    expect(mocks.createServer).toHaveBeenCalledTimes(1);
    expect(mocks.activateServer).toHaveBeenNthCalledWith(
      1,
      "stg-456",
      "activation-key-1",
    );
    expect(mocks.activateServer).toHaveBeenNthCalledWith(
      2,
      "stg-456",
      "activation-key-2",
    );
    expect(result.current.setupPending).toBe(false);
    expect(mocks.push).toHaveBeenCalledWith("/dashboard");
  });
});

function setValidForm(current: ReturnType<typeof useCreateStorageServerScreen>) {
  act(() => {
    current.setForm({
      name: "Garage Primary",
      code: "garage-primary",
      endpoint: "https://garage.example.com",
      region: "us-east-1",
      bucketName: "my-bucket",
      maxTenants: null,
      credentials: {
        accessKeyId: "KEY123",
        secretAccessKey: "SECRET123456789012",
      },
    });
  });
}

async function submit(
  handler: ReturnType<typeof useCreateStorageServerScreen>["handleSubmit"],
) {
  const event = { preventDefault: vi.fn() } as unknown as React.FormEvent;
  await act(async () => {
    await handler(event);
  });
}
