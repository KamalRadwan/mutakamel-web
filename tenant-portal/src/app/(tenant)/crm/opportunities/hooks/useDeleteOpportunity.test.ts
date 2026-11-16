// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useDeleteOpportunity } from "./useDeleteOpportunity";

const { remove } = vi.hoisted(() => ({ remove: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: { delete: remove },
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it.each([500, 409])("retains the normalized HTTP %s failure for translated display", async (status) => {
  remove.mockRejectedValue(new TenantApiClientError("Backend message", {
    status, statusText: "Error", headers: new Headers(),
    data: { message: "Backend message", correlationId: "reference" },
  }));
  const { result } = renderHook(useDeleteOpportunity);
  await act(async () => { expect(await result.current.deleteOpportunity("one")).toBe(false); });
  expect(result.current.error).toMatchObject({ status, message: "Backend message", correlationId: "reference" });
  expect(result.current.isDeleting).toBe(false);
  act(() => result.current.clearError());
  expect(result.current.error).toBeNull();
});
