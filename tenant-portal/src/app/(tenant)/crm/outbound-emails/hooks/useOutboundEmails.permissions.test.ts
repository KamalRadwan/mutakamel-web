// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOutboundEmails } from "./useOutboundEmails";
import { useOutboundEmailDetail } from "./useOutboundEmailDetail";

const { auth, get } = vi.hoisted(() => ({
  auth: { user: { permissions: [] as string[] } },
  get: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: {}, lang: "en" }) }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get } }));

const EMAIL_ID = "01900500-0000-7000-8000-000000000001";
const failedEmail = {
  outboundEmailId: EMAIL_ID,
  activityId: EMAIL_ID,
  sourceType: "LEAD",
  sourceId: EMAIL_ID,
  status: "FAILED",
  recipient: { displayName: "Sara", maskedAddress: "s***@example.com" },
  sender: { displayName: "CRM", maskedAddress: "n***@example.com" },
  content: { state: "AVAILABLE", subject: "Hello", text: "Hello" },
  failure: null,
  feedback: [],
  timeline: [],
  requestedAt: "2026-10-17T09:00:00.000Z",
};

beforeEach(() => {
  get.mockImplementation((url: string) => Promise.resolve({
    data: url.includes(EMAIL_ID)
      ? failedEmail
      : { items: [], nextCursor: null, hasNext: false },
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("outbound-email action permissions", () => {
  it("updates both controls when the authenticated send grant changes", async () => {
    auth.user.permissions = ["crm.activities.read.own", "crm.email.send.own"];
    const list = renderHook(() => useOutboundEmails());
    const detail = renderHook(() => useOutboundEmailDetail(EMAIL_ID));

    await waitFor(() => expect(detail.result.current.detail?.status).toBe("FAILED"));
    expect(list.result.current.canSend).toBe(true);
    expect(detail.result.current.canSend).toBe(true);

    auth.user.permissions = ["crm.activities.read.own"];
    list.rerender();
    detail.rerender();
    expect(list.result.current.canSend).toBe(false);
    expect(detail.result.current.canSend).toBe(false);
  });

  it.each(["own", "team", "all"])("allows Compose and failed-email Retry with send.%s", async (scope) => {
    auth.user.permissions = ["crm.activities.read.own", `crm.email.send.${scope}`];
    const list = renderHook(() => useOutboundEmails());
    const detail = renderHook(() => useOutboundEmailDetail(EMAIL_ID));

    await waitFor(() => expect(detail.result.current.detail?.status).toBe("FAILED"));
    expect(list.result.current.canSend).toBe(true);
    expect(detail.result.current.canSend).toBe(true);
    expect(detail.result.current.queryError).toBeNull();
  });

  it("hides Compose and failed-email Retry without any send grant", async () => {
    auth.user.permissions = ["crm.activities.read.own"];
    const list = renderHook(() => useOutboundEmails());
    const detail = renderHook(() => useOutboundEmailDetail(EMAIL_ID));

    await waitFor(() => expect(detail.result.current.detail?.status).toBe("FAILED"));
    expect(list.result.current.canSend).toBe(false);
    expect(detail.result.current.canSend).toBe(false);
    await expect(detail.result.current.retry("Try again")).resolves.toEqual({
      ok: false,
      replayed: false,
      error: { status: 403, code: "FORBIDDEN" },
    });
  });
});
