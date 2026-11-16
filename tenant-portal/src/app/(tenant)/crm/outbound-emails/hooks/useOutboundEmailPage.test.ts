// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOutboundEmailPage } from "./useOutboundEmailPage";

const { post, reload, success, info, uuid } = vi.hoisted(() => ({ post: vi.fn(), reload: vi.fn(), success: vi.fn(), info: vi.fn(), uuid: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: {
  id: "actor-a", permissions: ["crm.activities.read.own", "crm.email.send.own"], featureEntitlements: { "crm.outbound_email": true },
} }) }));
vi.mock("@/i18n/I18nContext", async () => {
  const { en } = await import("@/i18n/dictionaries/en");
  return { useI18n: () => ({ t: en, lang: "en" }) };
});
vi.mock("@/design-system", async (original) => ({ ...await original<typeof import("@/design-system")>(), useToast: () => ({ success, info }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./useOutboundEmails", async (original) => ({
  ...await original<typeof import("./useOutboundEmails")>(), useOutboundEmails: () => ({ canSend: true, reload }),
}));
vi.mock("@/lib/api/axiosClient", async (original) => ({ ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { post } }));
vi.mock("@/lib/uuid", async (original) => ({ ...await original<typeof import("@/lib/uuid")>(), generateUUIDv7: uuid }));

const sourceId = "01900500-0000-7000-8000-000000000001";
const childId = "01900500-0000-7000-8000-000000000002";
const recipient = { kind: "SOURCE_PRIMARY_CONTACT" as const };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("compose session recovery", () => {
  it("blocks UI close/reopen from replacing an uncertain intent and reconciles the original body/key", async () => {
    uuid.mockReturnValue("01900500-0000-7000-8000-000000000009");
    post.mockResolvedValueOnce({ data: { sourceType: "LEAD", sourceId, resolvedLocale: "en",
      recipients: [{ reference: recipient, displayName: "Ahmed", maskedAddress: "a***@***", isPrimary: true }],
      templates: [], assignedTemplateVersionId: null, availability: [],
    } }).mockRejectedValueOnce(new Error("Network interrupted")).mockResolvedValueOnce({
      data: { outboundEmailId: childId, status: "QUEUED", requestedAt: "2026-11-03T10:00:00.000Z", recipient: { displayName: "Ahmed", maskedAddress: "a***@***" } }, headers: new Headers(),
    });
    const { result } = renderHook(() => useOutboundEmailPage());
    act(() => result.current.openComposer());
    await act(async () => { await result.current.composer.loadOptions("LEAD", sourceId); });
    const keysBeforeSend = uuid.mock.calls.length;
    act(() => result.current.send("LEAD", sourceId, recipient, null));
    await waitFor(() => expect(result.current.composer.uncertain).toBe(true));
    const session = result.current.session;
    act(() => { result.current.closeComposer(false); result.current.openComposer(); });
    expect(result.current.isComposeOpen).toBe(true);
    expect(result.current.session).toBe(session);
    expect(uuid).toHaveBeenCalledTimes(keysBeforeSend + 1);
    expect(success).not.toHaveBeenCalled();
    act(() => result.current.reconcile());
    await waitFor(() => expect(result.current.isComposeOpen).toBe(false));
    expect(post.mock.calls[2]).toEqual(post.mock.calls[1]);
    expect(uuid).toHaveBeenCalledTimes(keysBeforeSend + 1);
    expect(success).toHaveBeenCalledTimes(1);
  });
});
