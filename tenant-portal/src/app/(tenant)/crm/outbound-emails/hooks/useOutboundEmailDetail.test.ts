// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOutboundEmailDetail } from "./useOutboundEmailDetail";

const { auth, get, post } = vi.hoisted(() => ({
  auth: { user: { permissions: ["crm.email.send.own"] } },
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: {}, lang: "en" }) }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/axiosClient")>(),
  axiosClient: { get, post },
}));

const PARENT_ID = "01900500-0000-7000-8000-000000000001";
const CHILD_ID = "01900500-0000-7000-8000-000000000002";
const party = { displayName: "Sara", maskedAddress: "s***@example.com" };
const failedEmail = {
  outboundEmailId: PARENT_ID,
  activityId: PARENT_ID,
  sourceType: "LEAD",
  sourceId: PARENT_ID,
  status: "FAILED",
  recipient: party,
  sender: party,
  content: { state: "AVAILABLE", subject: "Hello", text: "Hello" },
  feedback: [],
  timeline: [],
  requestedAt: "2026-10-18T09:00:00.000Z",
};

beforeEach(() => {
  auth.user.permissions = ["crm.email.send.own"];
  get.mockResolvedValue({ data: failedEmail });
  post.mockResolvedValue({
    data: { outboundEmailId: CHILD_ID, status: "QUEUED", requestedAt: failedEmail.requestedAt, recipient: party },
    headers: new Headers(),
  });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("outbound email retry lineage", () => {
  it("returns the accepted child and prevents a second retry without reloading the parent", async () => {
    const { result } = renderHook(() => useOutboundEmailDetail(PARENT_ID));
    await waitFor(() => expect(result.current.canRetry).toBe(true));
    await act(async () => {
      expect(await result.current.retry("Provider recovered")).toEqual({
        ok: true, outboundEmailId: CHILD_ID, replayed: false, error: null,
      });
    });
    expect(result.current.detail?.retriedById).toBe(CHILD_ID);
    expect(result.current.canRetry).toBe(false);
    expect(get).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      `/api/tenant/crm/v1/outbound-emails/${PARENT_ID}/retry`,
      { reason: "Provider recovered" }, expect.objectContaining({ nonReplayable: true }),
    );
    await act(async () => { expect((await result.current.retry("Again")).ok).toBe(false); });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it.each([
    { retriedById: CHILD_ID },
    { content: { state: "REDACTED_BY_RETENTION", redactedAt: failedEmail.requestedAt } },
    { status: "QUEUED" },
    { status: "DISPATCHING" },
    { status: "SENT" },
  ])("blocks retry for ineligible detail %j", async (override) => {
    get.mockResolvedValue({ data: { ...failedEmail, ...override } });
    const { result } = renderHook(() => useOutboundEmailDetail(PARENT_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canRetry).toBe(false);
    await act(async () => { expect((await result.current.retry("Again")).ok).toBe(false); });
    expect(post).not.toHaveBeenCalled();
  });

  it("does not claim success or set lineage for a malformed acceptance", async () => {
    post.mockResolvedValue({ data: { outboundEmailId: CHILD_ID, status: "SENT" }, headers: new Headers() });
    const { result } = renderHook(() => useOutboundEmailDetail(PARENT_ID));
    await waitFor(() => expect(result.current.canRetry).toBe(true));
    await act(async () => { expect((await result.current.retry("Again")).ok).toBe(false); });
    expect(result.current.detail?.retriedById).toBeNull();
  });
});
