// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { RecordAttachmentsSection } from "./RecordAttachmentsSection";

const fixture = vi.hoisted(() => ({
  attachmentId: "0192f3a0-0000-7000-8000-000000000001",
  branchId: "0192f3a0-0000-7000-8000-000000000002",
  sourceId: "0192f3a0-0000-7000-8000-000000000003",
}));
const state = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: state.lang === "ar" ? ar : en, lang: state.lang }),
}));
vi.mock("../hooks/useCrmAttachments", () => ({
  useCrmAttachments: () => ({
    attachments: [{
      id: fixture.attachmentId,
      branchId: fixture.branchId,
      sourceId: fixture.sourceId,
      sourceType: "LEAD",
      fileName: "report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1,
      uploadedByUserId: null,
      createdAt: "2026-10-31T00:00:00.000Z",
    }],
    loadError: null, writeError: null, isLoading: false, isUploading: false,
    pendingId: null, ambiguity: null, appliedUnreadable: null,
  }),
}));
vi.mock("../hooks/useAmbiguousOutcomeLabels", () => ({
  useAmbiguousOutcomeLabels: () => ({}), useAppliedUnreadableLabels: () => ({}),
}));
vi.mock("@/design-system", async (original) => ({
  ...await original<typeof import("@/design-system")>(),
  PermissionGate: ({ children }: { children: ReactNode }) => children,
  DetailSection: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  ConfirmActionModal: () => null,
  DateTime: () => null,
  AttachmentList: ({ onDownload }: { onDownload: (attachment: { id: string; name: string }) => void }) =>
    <button onClick={() => onDownload({ id: fixture.attachmentId, name: "report.pdf" })}>Download test file</button>,
}));

const props = {
  branchId: fixture.branchId, sourceId: fixture.sourceId, sourceType: "LEAD" as const,
  sourceOwnerUserId: null, createCapability: null, deleteCapability: null,
};
beforeEach(() => {
  state.lang = "en";
  window.localStorage.clear();
  window.sessionStorage.clear();
  // Keep URL construction real: the tenant transport validates Gateway paths.
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => "blob:http://localhost/download");
    static revokeObjectURL = vi.fn();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(["ar", "en"] as const)("keeps the page mounted after download errors in %s", async (lang) => {
  state.lang = lang;
  const dictionary = lang === "ar" ? ar : en;
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const locationBefore = window.location.href;
  render(<RecordAttachmentsSection {...props} />);
  for (const status of [401, 403, 404, 429]) {
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status }));
    fireEvent.click(screen.getByText("Download test file"));
    expect(await screen.findByText(dictionary.crmAttachments.downloadFailedTitle)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/tenant/crm/v1/attachments/${fixture.attachmentId}/download`,
      expect.objectContaining({ method: "GET", cache: "no-store", credentials: "include" }),
    );
    if (status === 404) expect(screen.getByText(dictionary.crmShared.errorNotFound)).toBeTruthy();
    expect(screen.getByText("Download test file")).toBeTruthy();
    expect(window.location.href).toBe(locationBefore);
    expect(click).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(dictionary.common.dismiss));
    expect(screen.queryByText(dictionary.crmAttachments.downloadFailedTitle)).toBeNull();
  }
});

it("downloads the blob through the tenant transport on 200", async () => {
  const bytes = new Uint8Array([0, 255, 128, 42]);
  const fetchMock = vi.fn<typeof fetch>(async () =>
    new Response(bytes, { headers: { "Content-Type": "application/pdf" } }));
  vi.stubGlobal("fetch", fetchMock);
  const anchors: HTMLAnchorElement[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.isConnected).toBe(true);
    anchors.push(this);
  });
  const locationBefore = window.location.href;
  render(<RecordAttachmentsSection {...props} />);
  fireEvent.click(screen.getByText("Download test file"));
  await waitFor(() => expect(anchors).toHaveLength(1));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe(`/api/tenant/crm/v1/attachments/${fixture.attachmentId}/download`);
  expect(init).toMatchObject({ method: "GET", cache: "no-store", credentials: "include" });
  expect(init).not.toHaveProperty("responseType");
  expect(new Headers(init?.headers).get("Accept")).toBe("*/*");
  expect(new Headers(init?.headers).has("Range")).toBe(false);
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
  expect(blob.type).toBe("application/pdf");
  expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
  expect(anchors[0].getAttribute("href")).toBe("blob:http://localhost/download");
  expect(anchors[0].download).toBe("report.pdf");
  expect(anchors[0].isConnected).toBe(false);
  expect(window.location.href).toBe(locationBefore);
  await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/download"));
});
