// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOutboundEmailComposer } from "./useOutboundEmailComposer";

const { auth, post } = vi.hoisted(() => ({
  auth: { user: { id: "actor-a", permissions: ["crm.email.send.own"], featureEntitlements: { "crm.outbound_email": true } } },
  post: vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { post },
}));
const first = "01900500-0000-7000-8000-000000000001";
const second = "01900500-0000-7000-8000-000000000002";
const recipient = { kind: "SOURCE_PRIMARY_CONTACT" as const };
const options = (id: string) => ({ sourceType: "LEAD", sourceId: id, resolvedLocale: "en",
  recipients: [{ reference: recipient, displayName: id, maskedAddress: "a***@***", isPrimary: true }],
  templates: [], assignedTemplateVersionId: null, availability: [],
});
const preview = { subject: "Old preview", preheader: null, bodyHtml: "<p>Old</p>", bodyText: "Old", direction: "LTR", resolvedLocale: "en", templateVersionNumber: 1 };
beforeEach(() => { post.mockReset(); auth.user.id = "actor-a"; auth.user.permissions = ["crm.email.send.own"]; });
afterEach(cleanup);

describe("outbound source and preview isolation", () => {
  it("ignores options for a source replaced by a later selection", async () => {
    const pending: Array<(value: unknown) => void> = [];
    post.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const { result } = renderHook(() => useOutboundEmailComposer());
    act(() => { void result.current.loadOptions("LEAD", first); void result.current.loadOptions("LEAD", second); });
    await act(async () => { pending[1]({ data: options(second) }); });
    await act(async () => { pending[0]({ data: options(first) }); });
    expect(result.current.options?.sourceId).toBe(second);
    expect(post.mock.calls[0][2]).toMatchObject({ skipAutoIdempotency: true });
  });

  it("does not restore a preview after the recipient/template selection has invalidated it", async () => {
    let resolve!: (value: unknown) => void;
    post.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { result } = renderHook(() => useOutboundEmailComposer());
    act(() => { void result.current.loadPreview("LEAD", first, recipient, null); result.current.clearPreview(); });
    await act(async () => { resolve({ data: preview }); });
    expect(result.current.preview).toBeNull();
    expect(result.current.isPreviewing).toBe(false);
  });

  it("hides source recipients and preview under a new actor before new reads finish", async () => {
    post.mockResolvedValue({ data: options(first) });
    const underNewActor: unknown[] = [];
    const { result, rerender } = renderHook(() => {
      const composer = useOutboundEmailComposer();
      if (auth.user.id === "actor-b") underNewActor.push(composer.options, composer.preview);
      return composer;
    });
    await act(async () => { await result.current.loadOptions("LEAD", first); });
    await waitFor(() => expect(result.current.options?.sourceId).toBe(first));
    auth.user.id = "actor-b";
    rerender();
    expect(result.current.options).toBeNull();
    expect(result.current.preview).toBeNull();
    expect(underNewActor.length).toBeGreaterThan(0);
    expect(underNewActor.every((value) => value === null)).toBe(true);
  });
});
