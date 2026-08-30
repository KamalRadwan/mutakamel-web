// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useTenantAuth = vi.fn();

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => useTenantAuth() as unknown,
}));

const { useAccessMode } = await import("./useAccessMode");

afterEach(() => {
  cleanup();
  useTenantAuth.mockReset();
});

describe("useAccessMode", () => {
  it("reports unresolved while no server contract carries the field, and does not invent FULL", () => {
    useTenantAuth.mockReturnValue({ user: { id: "u1", permissions: [] } });
    const { result } = renderHook(() => useAccessMode());

    expect(result.current.mode).toBeNull();
    expect(result.current.isResolved).toBe(false);
  });

  it("leaves mutating affordances available while unresolved — the backend is authoritative", () => {
    useTenantAuth.mockReturnValue({ user: { id: "u1", permissions: [] } });
    const { result } = renderHook(() => useAccessMode());

    expect(result.current.canMutate).toBe(true);
    expect(result.current.canRead).toBe(true);
    expect(result.current.isRestricted).toBe(false);
  });

  it("stays unresolved for a signed-out session rather than throwing", () => {
    useTenantAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useAccessMode());

    expect(result.current.mode).toBeNull();
    expect(result.current.isResolved).toBe(false);
  });

  it("resolves the moment the profile actually carries a valid wire value", () => {
    useTenantAuth.mockReturnValue({ user: { id: "u1", accessMode: "READ_ONLY" } });
    const { result } = renderHook(() => useAccessMode());

    expect(result.current.mode).toBe("READ_ONLY");
    expect(result.current.isResolved).toBe(true);
    expect(result.current.canMutate).toBe(false);
  });

  it("ignores a value that is not one of the four wire values", () => {
    useTenantAuth.mockReturnValue({ user: { id: "u1", accessMode: "read_only" } });
    const { result } = renderHook(() => useAccessMode());

    expect(result.current.mode).toBeNull();
    expect(result.current.isResolved).toBe(false);
  });
});
