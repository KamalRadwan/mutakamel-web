// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOpportunitiesList } from "./useOpportunitiesList";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get } };
});
// `useRealtimeResync` is the list hook's only design-system import, and it only
// attaches window listeners. Stubbing it keeps this test off the barrel.
vi.mock("@/design-system", () => ({ useRealtimeResync: () => undefined }));

const BRANCH = "01900100-0000-7000-8000-000000000099";
const PIPELINE = "01900100-0000-7000-8000-000000000100";
const STAGE = "01900100-0000-7000-8000-000000000101";

const LIST_PAGE = { items: [], page: 1, limit: 25, total: 0 };

// The hook fetches from a queued microtask inside an effect.
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  get.mockResolvedValue({ data: LIST_PAGE });
});

afterEach(() => {
  cleanup();
  get.mockReset();
});

// These assert the whole query string rather than one parameter, because
// crm-app validates with forbidNonWhitelisted: an extra or misspelled key is a
// hard 400 on every list open, not a parameter the server quietly ignores.
describe("opportunity stage filter requests", () => {
  it("adds stageId beside the pipelineId the table already sent", async () => {
    renderHook(() => useOpportunitiesList(BRANCH, PIPELINE, STAGE));
    await settle();

    expect(get).toHaveBeenCalledWith(
      `/api/tenant/crm/v1/opportunities?branchId=${BRANCH}&page=1&limit=25&sortBy=createdAt&sortDir=DESC&pipelineId=${PIPELINE}&stageId=${STAGE}`,
      expect.anything(),
    );
  });

  it("omits the key entirely for All rather than sending it empty", async () => {
    renderHook(() => useOpportunitiesList(BRANCH, PIPELINE, null));
    await settle();

    expect(get).toHaveBeenCalledWith(
      `/api/tenant/crm/v1/opportunities?branchId=${BRANCH}&page=1&limit=25&sortBy=createdAt&sortDir=DESC&pipelineId=${PIPELINE}`,
      expect.anything(),
    );
  });

  it("restarts the table at page 1 when the stage changes", async () => {
    const { rerender } = renderHook(
      ({ stageId }: { stageId: string | null }) =>
        useOpportunitiesList(BRANCH, PIPELINE, stageId),
      { initialProps: { stageId: null as string | null } },
    );
    await settle();
    await act(async () => {
      await Promise.resolve();
    });

    get.mockClear();
    rerender({ stageId: STAGE });
    await settle();

    // page=1, not whatever page the unfiltered list was left on.
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining(`page=1&limit=25&sortBy=createdAt&sortDir=DESC&pipelineId=${PIPELINE}&stageId=${STAGE}`),
      expect.anything(),
    );
  });


});
