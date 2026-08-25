// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, listMock, entityHistoryMock } = vi.hoisted(() => ({
  authMock: {
    user: {
      isSuperAdmin: false,
      permissions: ["admin.audit.read"],
    } as { isSuperAdmin: boolean; permissions: string[] } | null,
    isLoading: false,
  },
  listMock: vi.fn(),
  entityHistoryMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("../api/control-plane-audit-api", () => ({
  controlPlaneAuditApi: {
    list: listMock,
    entityHistory: entityHistoryMock,
  },
}));

import { useControlPlaneAudit } from "./use-control-plane-audit";

const EMPTY_PAGE = {
  items: [],
  total: 0,
  page: 1,
  limit: 25,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

describe("useControlPlaneAudit", () => {
  beforeEach(() => {
    authMock.user = { isSuperAdmin: false, permissions: ["admin.audit.read"] };
    authMock.isLoading = false;
    listMock.mockReset().mockResolvedValue(EMPTY_PAGE);
    entityHistoryMock.mockReset().mockResolvedValue(EMPTY_PAGE);
  });

  it("loads the bounded global audit page for an authorized admin", async () => {
    const { result } = renderHook(() => useControlPlaneAudit());

    await waitFor(() => expect(result.current.requestState).toBe("EMPTY"));
    expect(listMock).toHaveBeenCalledWith(
      { page: 1, limit: 25 },
      expect.any(AbortSignal),
    );
  });

  it("does not request audit data without the read permission", async () => {
    authMock.user = { isSuperAdmin: false, permissions: [] };
    const { result } = renderHook(() => useControlPlaneAudit());

    await waitFor(() => expect(result.current.requestState).toBe("FORBIDDEN"));
    expect(listMock).not.toHaveBeenCalled();
    expect(entityHistoryMock).not.toHaveBeenCalled();
  });

  it("requires entity scope and then calls the dedicated history route", async () => {
    const { result } = renderHook(() => useControlPlaneAudit());
    await waitFor(() => expect(result.current.requestState).toBe("EMPTY"));
    listMock.mockClear();

    act(() => result.current.setMode("ENTITY_HISTORY"));
    let applied = true;
    act(() => {
      applied = result.current.applyFilters();
    });
    expect(applied).toBe(false);
    expect(result.current.validationErrors).toMatchObject({
      entityType: expect.any(String),
      entityId: expect.any(String),
    });

    act(() => {
      result.current.updateDraft("entityType", "TenantEntity");
      result.current.updateDraft("entityId", "tenant-1");
    });
    act(() => {
      expect(result.current.applyFilters()).toBe(true);
    });

    await waitFor(() => expect(entityHistoryMock).toHaveBeenCalledWith(
      "TenantEntity",
      "tenant-1",
      { page: 1, limit: 25 },
      expect.any(AbortSignal),
    ));
    expect(listMock).not.toHaveBeenCalled();
  });
});
