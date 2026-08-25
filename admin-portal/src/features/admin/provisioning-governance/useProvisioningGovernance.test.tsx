// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserProfile } from "@/context/AuthContext";

const {
  authMock,
  listComponentsMock,
  listReleasesMock,
  listRunsMock,
  getRunMock,
  createRunMock,
  keyMock,
} = vi.hoisted(() => ({
  authMock: {
    user: null as UserProfile | null,
    isLoading: false,
  },
  listComponentsMock: vi.fn(),
  listReleasesMock: vi.fn(),
  listRunsMock: vi.fn(),
  getRunMock: vi.fn(),
  createRunMock: vi.fn(),
  keyMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/lib/utils/uuid", () => ({ generateUUIDv7: keyMock }));
vi.mock("./api", () => ({
  provisioningGovernanceApi: {
    listComponents: listComponentsMock,
    listComponentReleases: listReleasesMock,
    listDiscoveryRuns: listRunsMock,
    getDiscoveryRun: getRunMock,
    createDiscoveryRun: createRunMock,
  },
}));

import {
  COMPONENT_PAGE,
  OPERATOR_ID,
  RELEASE_PAGE,
  RUN,
} from "./test-fixtures";
import { useProvisioningGovernance } from "./useProvisioningGovernance";

const FULL_PERMISSIONS = [
  "admin.tenants.read",
  "admin.provisioning.discovery.read",
  "admin.provisioning.discovery.run",
  "admin.provisioning.critical",
];

function actor(id = OPERATOR_ID, permissions = FULL_PERMISSIONS): UserProfile {
  return {
    id,
    email: "operator@example.test",
    firstName: "Admin",
    lastName: "Operator",
    isSuperAdmin: false,
    role: { id: "019f0000-0000-7000-8000-000000000099", name: "operator" },
    status: "ACTIVE",
    permissions,
  };
}

describe("useProvisioningGovernance", () => {
  beforeEach(() => {
    authMock.user = actor();
    authMock.isLoading = false;
    listComponentsMock.mockReset().mockResolvedValue(COMPONENT_PAGE);
    listReleasesMock.mockReset().mockResolvedValue(RELEASE_PAGE);
    listRunsMock.mockReset().mockResolvedValue({
      items: [RUN],
      correlationId: COMPONENT_PAGE.correlationId,
      timestamp: COMPONENT_PAGE.timestamp,
    });
    getRunMock.mockReset();
    createRunMock.mockReset().mockResolvedValue(RUN);
    let keyIndex = 10;
    keyMock.mockReset().mockImplementation(() => {
      keyIndex += 1;
      return `019f0000-0000-7000-8000-${String(keyIndex).padStart(12, "0")}`;
    });
  });

  it("preflights each read permission and exposes no unauthorized transport", () => {
    authMock.user = actor(OPERATOR_ID, []);

    const { result } = renderHook(() => useProvisioningGovernance());

    expect(result.current.catalogue.state).toBe("FORBIDDEN");
    expect(result.current.discovery.state).toBe("FORBIDDEN");
    expect(result.current.permissions.canRunDiscovery).toBe(false);
    expect(listComponentsMock).not.toHaveBeenCalled();
    expect(listRunsMock).not.toHaveBeenCalled();
  });

  it("loads catalogue and discovery with the exact bounded defaults", async () => {
    const { result } = renderHook(() => useProvisioningGovernance());

    await waitFor(() => expect(result.current.catalogue.state).toBe("READY"));
    await waitFor(() => expect(result.current.discovery.state).toBe("READY"));
    expect(listComponentsMock).toHaveBeenCalledWith(
      { page: 1, limit: 20, sortBy: "key", sortDir: "ASC" },
      expect.any(AbortSignal),
    );
    expect(listRunsMock).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("hides the previous operator response immediately during an authorized switch", async () => {
    const { result, rerender } = renderHook(() => useProvisioningGovernance());
    await waitFor(() => expect(result.current.catalogue.state).toBe("READY"));
    listComponentsMock.mockImplementation(() => new Promise(() => undefined));
    listRunsMock.mockImplementation(() => new Promise(() => undefined));

    authMock.user = actor("019f0000-0000-7000-8000-000000000088");
    rerender();

    expect(result.current.catalogue).toMatchObject({
      state: "LOADING",
      data: null,
    });
    expect(result.current.discovery).toMatchObject({
      state: "LOADING",
      data: null,
    });
    await waitFor(() => expect(listComponentsMock).toHaveBeenCalledTimes(2));
  });

  it("loads releases only after an authorized component selection", async () => {
    const { result } = renderHook(() => useProvisioningGovernance());
    await waitFor(() => expect(result.current.catalogue.state).toBe("READY"));

    act(() => result.current.selectComponent(COMPONENT_PAGE.items[0]));

    await waitFor(() => expect(result.current.releases.state).toBe("READY"));
    expect(listReleasesMock).toHaveBeenCalledWith(
      COMPONENT_PAGE.items[0].id,
      { page: 1, limit: 20, sortBy: "publishedAt", sortDir: "DESC" },
      expect.any(AbortSignal),
    );
  });

  it("reuses one caller key only for an exact ambiguous command retry", async () => {
    createRunMock
      .mockRejectedValueOnce({
        response: {
          status: 503,
          data: {
            code: "UPSTREAM_UNAVAILABLE",
            correlationId: COMPONENT_PAGE.correlationId,
          },
        },
      })
      .mockResolvedValueOnce(RUN);
    const command = {
      mode: "DRY_RUN" as const,
      cutoffAt: "2020-01-01T00:00:00.000Z",
      maxTenants: 100,
    };
    const { result } = renderHook(() => useProvisioningGovernance());
    await waitFor(() => expect(result.current.discovery.state).toBe("READY"));

    await act(async () => {
      expect(await result.current.runDiscovery(command)).toBeNull();
    });
    expect(result.current.mutation.exactRetryAvailable).toBe(true);
    await act(async () => {
      expect(await result.current.runDiscovery(command)).toEqual(RUN);
    });

    expect(createRunMock).toHaveBeenCalledTimes(2);
    expect(createRunMock.mock.calls[0][1]).toBe(createRunMock.mock.calls[1][1]);
    expect(result.current.mutation.result).toEqual(RUN);
  });

  it("rotates the identity after a definitive validation response", async () => {
    createRunMock
      .mockRejectedValueOnce({
        response: { status: 400, data: { code: "INVALID_COMMAND" } },
      })
      .mockResolvedValueOnce(RUN);
    const command = {
      mode: "MANUAL" as const,
      cutoffAt: "2020-01-01T00:00:00.000Z",
      maxTenants: 1,
    };
    const { result } = renderHook(() => useProvisioningGovernance());
    await waitFor(() => expect(result.current.discovery.state).toBe("READY"));

    await act(async () => void (await result.current.runDiscovery(command)));
    expect(result.current.mutation.exactRetryAvailable).toBe(false);
    await act(async () => void (await result.current.runDiscovery(command)));

    expect(createRunMock.mock.calls[0][1]).not.toBe(
      createRunMock.mock.calls[1][1],
    );
  });
});
