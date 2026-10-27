// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { PermissionScope } from "@/lib/auth/permission-scope";
import type { TemplateAsset } from "../../template-assets-contract";

const { auth, io, toast } = vi.hoisted(() => ({
  auth: { user: { permissions: ["templates.read", "templates.assets.manage"],
    permissionScopes: {} as Record<string, PermissionScope> } },
  io: { list: vi.fn(), retire: vi.fn(), upload: vi.fn(), definition: vi.fn(),
    restart: vi.fn(), advance: vi.fn(), goBack: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn() },
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", async () => ({
  ...await import("@/design-system/patterns/permission-gate/useCan"), useToast: () => toast,
}));
vi.mock("../../template-assets-contract", async (original) => ({
  ...await original<typeof import("../../template-assets-contract")>(),
  fetchTemplateAssets: io.list, retireTemplateAsset: io.retire, uploadTemplateAsset: io.upload,
}));
vi.mock("../../templates-api", () => ({ fetchTemplate: io.definition }));
vi.mock("../../hooks/useTemplateCursor", () => ({
  isExpiredCursor: () => false,
  useTemplateCursor: () => ({ cursor: null, restart: io.restart, advance: io.advance, goBack: io.goBack }),
}));
import { useTemplateAssets } from "./useTemplateAssets";

const COMPANY = "01900100-0000-7000-8000-000000000001";
const DEFINITION = "01900100-0000-7000-8000-000000000002";
const shared: TemplateAsset = {
  id: "01900100-0000-7000-8000-000000000003", definitionId: null,
  assetType: "IMAGE", originalFileName: "logo.png", mimeType: "image/png", sizeBytes: 100,
  deliveryClass: "PRIVATE_ONLY", status: "ACTIVE", revision: 1,
  etag: '"asset:01900100-0000-7000-8000-000000000003:1"', createdAt: "2026-10-17T00:00:00.000Z",
};
const attached: TemplateAsset = { ...shared, definitionId: DEFINITION };

beforeEach(() => {
  vi.clearAllMocks();
  auth.user.permissionScopes = Object.fromEntries(auth.user.permissions.map((key) => [key,
    { tenantWide: false, companyIds: [COMPANY], branchIds: [] }]));
  io.list.mockResolvedValue({ items: [], hasNextPage: false, nextCursor: null });
  io.definition.mockResolvedValue({ id: DEFINITION, scope: { type: "COMPANY", companyId: COMPANY } });
  io.retire.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("reusable and definition asset authority", () => {
  it("hides tenant-wide upload and reusable retirement for company holders", async () => {
    const { result } = renderHook(useTemplateAssets);
    expect(result.current.canUpload).toBe(false);
    expect(result.current.canRetire(shared)).toBe(false);
    act(() => { result.current.openUpload(); result.current.openRetire(shared); });
    expect(result.current.isUploadOpen).toBe(false);
    expect(result.current.retiring).toBeNull();
    expect(io.definition).not.toHaveBeenCalled();
    expect(io.retire).not.toHaveBeenCalled();
  });

  it("keeps retirement available for an authorized company definition", async () => {
    const { result } = renderHook(useTemplateAssets);
    act(() => result.current.openRetire(attached));
    await waitFor(() => expect(result.current.retiring?.id).toBe(attached.id));
    expect(io.definition).toHaveBeenCalledWith(DEFINITION);
    await act(async () => { await result.current.retire(); });
    expect(io.retire).toHaveBeenCalledWith(attached.id, attached.etag);
  });

  it("rejects a foreign definition before confirmation", async () => {
    io.definition.mockResolvedValue({ id: DEFINITION, scope: {
      type: "COMPANY", companyId: "01900100-0000-7000-8000-000000000009",
    } });
    const { result } = renderHook(useTemplateAssets);
    act(() => result.current.openRetire(attached));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(result.current.retiring).toBeNull();
    expect(io.retire).not.toHaveBeenCalled();
  });

  it("rechecks a prepared retirement after a grant change", async () => {
    const { result, rerender } = renderHook(useTemplateAssets);
    act(() => result.current.openRetire(attached));
    await waitFor(() => expect(result.current.retiring?.id).toBe(attached.id));
    auth.user.permissionScopes = {};
    rerender();
    await act(async () => { await result.current.retire(); });
    expect(io.retire).not.toHaveBeenCalled();
  });
});
