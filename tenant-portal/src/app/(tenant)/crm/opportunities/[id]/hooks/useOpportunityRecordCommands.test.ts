// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { OpportunityDetail } from "../../opportunity-contract";
import { useOpportunityRecordCommands } from "./useOpportunityRecordCommands";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (original) => ({ ...(await original<typeof import("@/lib/api/axiosClient")>()), axiosClient: api }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../../../leads/hooks/useCreateLeadTags", () => ({ useCreateLeadTags: () => ({ tags: [] }) }));
const item = { id: "01900100-0000-7000-8000-000000000001" } as OpportunityDetail;
const tagId = "01900100-0000-7000-8000-000000000002";
function refused(status: number) { return new TenantApiClientError("Refused", { status, statusText: "Refused", headers: new Headers(), data: {} }); }
function response(data: unknown) { return { data, status: 200, statusText: "OK", headers: new Headers() }; }
beforeEach(() => { vi.clearAllMocks(); api.post.mockRejectedValue(refused(503)); api.delete.mockRejectedValue(refused(503)); });
afterEach(cleanup);

describe("Non-replayable opportunity record commands", () => {
  it("retains the tag outcome lock after an unreadable collection and then reads without reposting", async () => {
    const reload = vi.fn();
    const { result } = renderHook(() => useOpportunityRecordCommands(item, reload, true, true));
    await act(async () => { await result.current.toggleTag(tagId, false); });
    expect(result.current.feedback?.kind).toBe("ambiguous");
    api.get.mockResolvedValueOnce(response(null));
    await act(async () => { await result.current.feedback?.replay(); });
    expect(result.current.feedback).not.toBeNull();
    expect(result.current.error).not.toBeNull();
    api.get.mockResolvedValueOnce(response([{ id: tagId, name: "Priority", backgroundColor: null, textColor: null }]));
    await act(async () => { await result.current.feedback?.replay(); });
    expect(result.current.feedback).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
    expect(api.post).toHaveBeenCalledOnce();
    expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining(`/opportunities/${item.id}/tags`), expect.any(Object));
  });
  it("keeps a failed deletion read locked and leaves an unavailable record without another DELETE", async () => {
    const { result } = renderHook(() => useOpportunityRecordCommands(item, vi.fn(), true, true));
    await act(async () => { await result.current.deleteRecord(); });
    api.get.mockRejectedValueOnce(refused(503));
    await act(async () => { await result.current.feedback?.replay(); });
    expect(result.current.feedback).not.toBeNull();
    expect(api.push).not.toHaveBeenCalled();
    api.get.mockRejectedValueOnce(refused(404));
    await act(async () => { await result.current.feedback?.replay(); });
    expect(api.push).toHaveBeenCalledWith("/crm/opportunities");
    expect(api.delete).toHaveBeenCalledOnce();
    expect(result.current.feedback).toBeNull();
  });
});
