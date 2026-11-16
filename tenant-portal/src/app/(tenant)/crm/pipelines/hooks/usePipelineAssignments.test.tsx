// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePipelineAssignments } from "./usePipelineAssignments";

const { get, put, auth } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), auth: { id: "assignments", permissions: ["crm.pipelines.read", "crm.pipelines.manage"] } }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: auth }) }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get, put } }));
const pipelineId = "01900200-0000-7000-8000-000000000001";
const userId = "01900200-0000-7000-8000-000000000002";
const teamId = "01900200-0000-7000-8000-000000000003";
let actorCounter = 0;
beforeEach(() => {
  auth.id = `assignments-${++actorCounter}`;
  get.mockImplementation(async (url: string) => ({ status: 200, data: url.includes("assignment-options")
    ? { users: [{ id: userId, label: "Nour", status: "ACTIVE" }], teams: [{ id: teamId, label: "Sales", status: "ACTIVE", code: "SALES" }] }
    : { accessMode: "RESTRICTED", userIds: [userId], teamIds: [teamId] } }));
  put.mockResolvedValue({ status: 200, data: { accessMode: "ALL", userIds: [], teamIds: [] }, headers: new Headers() });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("shows every removed target before Restricted becomes All and sends empty arrays", async () => {
  const { result } = renderHook(() => usePipelineAssignments(pipelineId, true));
  await waitFor(() => expect(result.current.assignments).not.toBeNull());
  await waitFor(() => expect(result.current.users[0]?.label).toBe("Nour"));
  act(() => result.current.setAccessMode("ALL"));
  expect(result.current.userDiff.removed).toEqual([expect.objectContaining({ id: userId, label: "Nour" })]);
  expect(result.current.teamDiff.removed).toEqual([expect.objectContaining({ id: teamId, label: "Sales" })]);
  await act(async () => { expect(await result.current.save()).toMatchObject({ ok: true }); });
  expect(put).toHaveBeenCalledWith(`/api/tenant/crm/v1/pipelines/${pipelineId}/assignments`, { accessMode: "ALL", userIds: [], teamIds: [] }, expect.any(Object));
});

it("keeps an invalid restricted draft without sending a replacement", async () => {
  const { result } = renderHook(() => usePipelineAssignments(pipelineId, true));
  await waitFor(() => expect(result.current.assignments).not.toBeNull());
  act(() => { result.current.setUserIds([]); result.current.setTeamIds([]); });
  await act(async () => { expect(await result.current.save()).toMatchObject({ ok: false, error: { code: "PIPELINE_ASSIGNMENTS_INVALID" } }); });
  expect(put).not.toHaveBeenCalled();
  expect(result.current.accessMode).toBe("RESTRICTED");
});
