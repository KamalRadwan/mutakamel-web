// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOutboundEmails } from "./useOutboundEmails";
import { useOutboundEmailDetail } from "./useOutboundEmailDetail";

const { auth, get } = vi.hoisted(() => ({ auth: { user: { id: "actor-a", permissions: ["crm.activities.read.own", "crm.email.send.own"] } }, get: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: {}, lang: "en" }) }));
vi.mock("@/lib/api/axiosClient", async (original) => ({ ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { get } }));
const id = "01900500-0000-7000-8000-000000000001";
const email = {
  outboundEmailId: id, activityId: id, sourceType: "LEAD", sourceId: id, status: "FAILED",
  requestedAt: "2026-11-03T09:00:00.000Z", recipient: { displayName: "Private recipient", maskedAddress: "p***@***" },
  sender: { displayName: "Sender", maskedAddress: "s***@***" }, requestedBy: { id, displayName: "Actor" },
  content: { state: "AVAILABLE", subject: "Private content", text: "Private text" }, timeline: [], feedback: [],
};
beforeEach(() => { get.mockReset(); auth.user.id = "actor-a"; });
afterEach(cleanup);

describe("scope-tagged outbound reads", () => {
  it("never renders previous history rows under the next actor while its request is pending", async () => {
    get.mockResolvedValueOnce({ data: { items: [email], nextCursor: null, hasNext: false } })
      .mockImplementation(() => new Promise(() => {}));
    const snapshots: string[][] = [];
    const { result, rerender } = renderHook(() => {
      const history = useOutboundEmails();
      if (auth.user.id === "actor-b") snapshots.push(history.items.map((item) => item.recipient.displayName));
      return history;
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    auth.user.id = "actor-b"; rerender();
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots.every((rows) => rows.length === 0)).toBe(true);
  });

  it("never renders the previous message content or permits retry under a changed scope", async () => {
    get.mockResolvedValueOnce({ data: email }).mockImplementation(() => new Promise(() => {}));
    const snapshots: Array<{ detail: unknown; canRetry: boolean }> = [];
    const { result, rerender } = renderHook(() => {
      const detail = useOutboundEmailDetail(id);
      if (auth.user.id === "actor-b") snapshots.push({ detail: detail.detail, canRetry: detail.canRetry });
      return detail;
    });
    await waitFor(() => expect(result.current.detail?.recipient.displayName).toBe("Private recipient"));
    auth.user.id = "actor-b"; rerender();
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots.every((snapshot) => snapshot.detail === null && snapshot.canRetry === false)).toBe(true);
  });
});
