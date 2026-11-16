// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { readCoreData } from "@/lib/api/envelope";
import { PUBLIC_BRANDING_LOGO_PATH } from "@/lib/branding/public-branding";
import { isUUIDv7 } from "@/lib/uuid";
import {
  BRANDING_FILE_INVALID_CODE,
  BRANDING_FILE_REQUIRED_CODE,
  BRANDING_MANAGE_PERMISSION,
  BRANDING_READ_PERMISSION,
  BRANDING_STORAGE_UNAVAILABLE_CODE,
  EMPTY_BRANDING,
  fetchBrandingSettings,
  updateBrandingSettings,
  uploadBrandingAsset,
  type BrandingSettings,
} from "../branding-contract";
import { useBranding } from "./useBranding";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
}));

type MockPermissionScope = {
  tenantWide: boolean;
  companyIds: string[];
  branchIds: string[];
};

function makeAuthState(actorId = "user-a", generation = "gen-1", canManage = true) {
  const permissionScopes: Record<string, MockPermissionScope> = {
    [BRANDING_READ_PERMISSION]: { tenantWide: true, companyIds: [], branchIds: [] },
  };
  if (canManage) {
    permissionScopes[BRANDING_MANAGE_PERMISSION] = {
      tenantWide: true,
      companyIds: [],
      branchIds: [],
    };
  }
  return {
    realtimeAuthGeneration: generation,
    user: {
      id: actorId,
      permissions: canManage
        ? [BRANDING_READ_PERMISSION, BRANDING_MANAGE_PERMISSION]
        : [BRANDING_READ_PERMISSION],
      permissionScopes,
      accessibleBranches: ["branch-1"],
      accessibleCompanies: ["company-1"],
      teamMemberships: [],
    },
  };
}

const mocks = vi.hoisted(() => ({
  canManage: true,
  auth: {
    realtimeAuthGeneration: "gen-1",
    user: {
      id: "user-a",
      permissions: ["branding.read", "branding.manage"],
      permissionScopes: {
        "branding.read": { tenantWide: true, companyIds: [], branchIds: [] },
        "branding.manage": { tenantWide: true, companyIds: [], branchIds: [] },
      } as Record<string, { tenantWide: boolean; companyIds: string[]; branchIds: string[] }>,
      accessibleBranches: ["branch-1"],
      accessibleCompanies: ["company-1"],
      teamMemberships: [],
    },
  },
  updateBranding: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    outcomeFromApi: vi.fn(() => false),
    errorFromApi: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => mocks.auth,
}));

vi.mock("@/context/BrandingContext", () => ({
  useTenantBranding: () => ({ updateBranding: mocks.updateBranding }),
}));

vi.mock("@/design-system", async (original) => ({
  ...(await original<typeof import("@/design-system")>()),
  useCan: () => mocks.canManage,
  useToast: () => mocks.toast,
}));

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/lib/api/envelope", async (original) => ({
  ...(await original<typeof import("@/lib/api/envelope")>()),
  readCoreData: vi.fn(),
}));

vi.mock("../branding-contract", async (original) => ({
  ...(await original<typeof import("../branding-contract")>()),
  fetchBrandingSettings: vi.fn(),
  updateBrandingSettings: vi.fn(),
  uploadBrandingAsset: vi.fn(),
}));

// Genuine decodable 68-byte 1×1 RGBA PNG.
const VALID_1X1_PNG_BYTES = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

function makePngFile(name = "logo.png", targetByteLength?: number): File {
  if (!targetByteLength || targetByteLength <= VALID_1X1_PNG_BYTES.byteLength) {
    return new File([VALID_1X1_PNG_BYTES], name, { type: "image/png" });
  }
  const padded = new Uint8Array(targetByteLength);
  padded.set(VALID_1X1_PNG_BYTES, 0);
  return new File([padded], name, { type: "image/png" });
}

const populatedBranding: BrandingSettings = {
  ...EMPTY_BRANDING,
  appName: "Acme Workspace",
  tabTitle: "Acme",
  primaryColor: "#2563eb",
  secondaryColor: "#64748b",
  hasLogo: false,
  hasIcon: false,
};

function apiError(status: number, data: Record<string, unknown> = {}): TenantApiClientError {
  return new TenantApiClientError("Request failed", {
    status,
    statusText: String(status),
    headers: new Headers(),
    data,
  });
}

const originalCreateImageBitmap = globalThis.createImageBitmap;
let bitmapCloseSpy = vi.fn();

beforeEach(() => {
  vi.mocked(fetchBrandingSettings).mockReset();
  vi.mocked(updateBrandingSettings).mockReset();
  vi.mocked(uploadBrandingAsset).mockReset();
  routerMock.push.mockReset();
  mocks.canManage = true;
  mocks.auth = makeAuthState("user-a", "gen-1", true);
  mocks.toast.outcomeFromApi.mockReturnValue(false);
  vi.mocked(fetchBrandingSettings).mockResolvedValue(EMPTY_BRANDING);
  bitmapCloseSpy = vi.fn();
  globalThis.createImageBitmap = vi.fn(async () => ({
    width: 128,
    height: 128,
    close: bitmapCloseSpy,
  }) as unknown as ImageBitmap);
});

afterEach(() => {
  cleanup();
  if (originalCreateImageBitmap) {
    globalThis.createImageBitmap = originalCreateImageBitmap;
  } else {
    Reflect.deleteProperty(globalThis, "createImageBitmap");
  }
  vi.clearAllMocks();
});

describe("branding write publication", () => {
  it("syncs clean metadata after an asset upload without creating phantom edits", async () => {
    vi.mocked(fetchBrandingSettings).mockResolvedValueOnce(populatedBranding);
    const saved = { ...populatedBranding, appName: "Changed remotely", hasLogo: true };
    vi.mocked(uploadBrandingAsset).mockResolvedValueOnce({ branding: saved, replayed: false });
    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.upload("logo", makePngFile("logo.png"));
    });
    expect(bitmapCloseSpy).toHaveBeenCalledTimes(1);
    expect(result.current.values.appName).toBe(saved.appName);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.canSave).toBe(false);
  });

  it("preserves edits made during upload and their original conflict baseline", async () => {
    vi.mocked(fetchBrandingSettings).mockResolvedValueOnce(populatedBranding);
    const saved = {
      ...populatedBranding,
      appName: "Remote name",
      tabTitle: "Remote title",
      hasLogo: true,
    };
    let complete!: (value: { branding: BrandingSettings; replayed: boolean }) => void;
    vi.mocked(uploadBrandingAsset).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let upload!: Promise<boolean>;
    act(() => {
      upload = result.current.upload("logo", makePngFile("logo.png"));
    });
    await waitFor(() => expect(uploadBrandingAsset).toHaveBeenCalledTimes(1));
    act(() => result.current.setValue({ appName: "My late edit" }));
    expect(result.current.canSave).toBe(false);
    await act(async () => {
      complete({ branding: saved, replayed: false });
      await upload;
    });
    expect(result.current.values.appName).toBe("My late edit");
    expect(result.current.values.tabTitle).toBe("Remote title");
    vi.mocked(fetchBrandingSettings).mockResolvedValue(saved);
    await act(async () => {
      await result.current.save();
    });
    expect(updateBrandingSettings).not.toHaveBeenCalled();
    expect(result.current.formError).toBe(en.tradeCommon.conflictDescription);
    act(() => result.current.discard());
    act(() => result.current.confirmDiscard());
    expect(result.current.values.appName).toBe("Remote name");
    expect(result.current.branding?.hasLogo).toBe(true);
    expect(result.current.isDirty).toBe(false);
  });

  it("fences synchronous same-tick save/upload, save/save, upload/upload, and busy discard overlaps", async () => {
    vi.mocked(fetchBrandingSettings).mockResolvedValueOnce(populatedBranding);
    let resolveSaveRead!: (value: BrandingSettings) => void;
    vi.mocked(fetchBrandingSettings).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSaveRead = resolve;
        }),
    );
    vi.mocked(updateBrandingSettings).mockResolvedValueOnce({
      ...populatedBranding,
      appName: "Saved Once",
    });

    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setValue({ appName: "Saved Once" }));

    let saveFirst!: Promise<void>;
    let saveSecond!: Promise<void>;
    let overlapUploadResult = true;
    act(() => {
      saveFirst = result.current.save();
      saveSecond = result.current.save();
      void result.current
        .upload("logo", makePngFile("logo.png"))
        .then((accepted) => {
          overlapUploadResult = accepted;
        });
      result.current.discard();
      result.current.reload();
    });

    expect(uploadBrandingAsset).not.toHaveBeenCalled();
    expect(result.current.isDiscardOpen).toBe(false);

    await act(async () => {
      resolveSaveRead(populatedBranding);
      await saveFirst;
      await saveSecond;
    });

    expect(overlapUploadResult).toBe(false);
    expect(updateBrandingSettings).toHaveBeenCalledTimes(1);
    expect(uploadBrandingAsset).not.toHaveBeenCalled();

    // Now test upload -> save + upload in the same synchronous tick (before decode settles).
    let resolveUpload!: (value: { branding: BrandingSettings; replayed: boolean }) => void;
    vi.mocked(uploadBrandingAsset).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );

    act(() => result.current.setValue({ tabTitle: "Pending Tab" }));

    let firstUpload!: Promise<boolean>;
    let secondUpload!: Promise<boolean>;
    let overlapSave!: Promise<void>;
    act(() => {
      firstUpload = result.current.upload("logo", makePngFile("logo.png"));
      secondUpload = result.current.upload("icon", makePngFile("icon.png"));
      overlapSave = result.current.save();
    });

    let firstAccepted = false;
    let secondAccepted = true;
    await waitFor(() => expect(uploadBrandingAsset).toHaveBeenCalledTimes(1));
    await act(async () => {
      secondAccepted = await secondUpload;
      await overlapSave;
      resolveUpload({
        branding: { ...populatedBranding, appName: "Saved Once", hasLogo: true },
        replayed: false,
      });
      firstAccepted = await firstUpload;
    });

    expect(firstAccepted).toBe(true);
    expect(secondAccepted).toBe(false);
    expect(uploadBrandingAsset).toHaveBeenCalledTimes(1);
    expect(updateBrandingSettings).toHaveBeenCalledTimes(1);
    expect(result.current.values.tabTitle).toBe("Pending Tab");
  });

  it("rejects oversized icons and undecodable images client-side without replacing saved assets", async () => {
    vi.mocked(fetchBrandingSettings).mockResolvedValueOnce({
      ...populatedBranding,
      hasLogo: true,
      hasIcon: true,
    });
    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 620 KiB icon exceeds 512 KiB icon cap and never hits uploadBrandingAsset.
    let accepted = true;
    await act(async () => {
      accepted = await result.current.upload("icon", makePngFile("icon.png", 620 * 1024));
    });
    expect(accepted).toBe(false);
    expect(uploadBrandingAsset).not.toHaveBeenCalled();
    expect(result.current.uploadError.icon).toBe("Icon must be 512 KB or smaller.");
    expect(result.current.branding?.hasIcon).toBe(true);
    expect(result.current.assetVersion).toBe(0);

    // Corrupt image rejected by native decoder leaves saved logo untouched.
    globalThis.createImageBitmap = vi.fn(async () => {
      throw new Error("Decode error");
    });
    await act(async () => {
      accepted = await result.current.upload(
        "logo",
        new File([new Uint8Array([9, 9, 9])], "corrupt.png", { type: "image/png" }),
      );
    });
    expect(accepted).toBe(false);
    expect(uploadBrandingAsset).not.toHaveBeenCalled();
    expect(result.current.uploadError.logo).toBe(en.coreSettings.brandingUi.fileInvalid);
    expect(result.current.branding?.hasLogo).toBe(true);
    expect(result.current.assetVersion).toBe(0);
  });

  it("distinguishes a malformed successful read from an offline request", async () => {
    const actual = await vi.importActual<typeof import("../branding-contract")>(
      "../branding-contract",
    );
    vi.mocked(readCoreData).mockResolvedValueOnce({ hasLogo: "invalid" });
    vi.mocked(fetchBrandingSettings).mockImplementationOnce(actual.fetchBrandingSettings);
    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasLoadError).toBe(true);
    expect(result.current.loadErrorDescription).toBe(en.coreSettings.invalidResponseDescription);
    expect(result.current.loadErrorDescription).not.toContain(en.coreIdentity.errors.OFFLINE);
    expect(result.current.canSave).toBe(false);
  });

  it("aborts a manual reload on unmount and ignores its late completion", async () => {
    const { result, unmount } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let signal: AbortSignal | undefined;
    let complete!: (value: BrandingSettings) => void;
    vi.mocked(fetchBrandingSettings).mockImplementationOnce((nextSignal) => {
      signal = nextSignal;
      return new Promise((resolve) => {
        complete = resolve;
      });
    });
    act(() => result.current.reload());
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      complete(populatedBranding);
    });
    expect(mocks.updateBranding).not.toHaveBeenCalled();
  });

  it.each([
    ["appName", "My name", "Their name"],
    ["tabTitle", "My title", "Their title"],
    ["primaryColor", "#2563eb", "#123456"],
    ["secondaryColor", "#2563eb", "#123456"],
  ] as const)("blocks a stale edited %s and keeps the draft", async (field, mine, theirs) => {
    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setValue({ [field]: mine }));
    vi.mocked(fetchBrandingSettings).mockResolvedValue({ ...EMPTY_BRANDING, [field]: theirs });
    await act(async () => {
      await result.current.save();
    });
    expect(fetchBrandingSettings).toHaveBeenCalledTimes(2);
    expect(updateBrandingSettings).not.toHaveBeenCalled();
    expect(mocks.updateBranding).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith(
      en.tradeCommon.conflictTitle,
      en.tradeCommon.conflictDescription,
    );
    expect(result.current.formError).toBe(en.tradeCommon.conflictDescription);
    expect(result.current.values[field]).toBe(mine);
    expect(result.current.isDiscardOpen).toBe(false);
    expect(result.current.isSaving).toBe(false);
  });

  it("allows changes to an unrelated stored field", async () => {
    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setValue({ appName: "Mine" }));
    vi.mocked(fetchBrandingSettings).mockResolvedValue({ ...EMPTY_BRANDING, tabTitle: "Theirs" });
    vi.mocked(updateBrandingSettings).mockResolvedValue({
      ...EMPTY_BRANDING,
      appName: "Mine",
      tabTitle: "Theirs",
    });
    await act(async () => {
      await result.current.save();
    });
    expect(updateBrandingSettings).toHaveBeenCalledWith({ appName: "Mine" });
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it("does not write when the fresh read fails", async () => {
    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setValue({ appName: "Mine" }));
    vi.mocked(fetchBrandingSettings).mockRejectedValue(new Error("Read failed"));
    await act(async () => {
      await result.current.save();
    });
    expect(updateBrandingSettings).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
  });

  it("publishes the validated saved name and color", async () => {
    vi.mocked(fetchBrandingSettings).mockResolvedValue({ ...EMPTY_BRANDING, fontFamily: "Arial" });
    const saved = {
      ...EMPTY_BRANDING,
      appName: "Saved tenant",
      primaryColor: "#2563eb",
      fontFamily: "Arial",
    };
    vi.mocked(updateBrandingSettings).mockResolvedValue(saved);
    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setValue({ appName: "Saved tenant", primaryColor: "#2563eb" }));
    await act(async () => {
      await result.current.save();
    });
    expect(updateBrandingSettings).toHaveBeenCalledWith({
      appName: "Saved tenant",
      primaryColor: "#2563eb",
    });
    expect(result.current.values).not.toHaveProperty("fontFamily");
    expect(result.current.isDiscardOpen).toBe(false);
    expect(mocks.updateBranding).toHaveBeenCalledWith({
      appName: saved.appName,
      primaryColor: saved.primaryColor,
      tabTitle: null,
      secondaryColor: null,
      fontFamily: "Arial",
      logoUrl: null,
      iconUrl: null,
    });
  });

  it("publishes a successful logo upload, including an idempotent replay", async () => {
    vi.mocked(uploadBrandingAsset).mockResolvedValue({
      branding: { ...EMPTY_BRANDING, hasLogo: true },
      replayed: true,
    });
    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.upload("logo", makePngFile("logo.png"));
    });
    expect(mocks.updateBranding).toHaveBeenCalledWith(
      expect.objectContaining({ logoUrl: PUBLIC_BRANDING_LOGO_PATH }),
    );
    expect(result.current.assetVersion).toBe(1);
  });

  it("does not publish a rejected save", async () => {
    vi.mocked(updateBrandingSettings).mockRejectedValue(new Error("Save failed"));
    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setValue({ appName: "Mine" }));
    await act(async () => {
      await result.current.save();
    });
    expect(updateBrandingSettings).toHaveBeenCalledWith({ appName: "Mine" });
    expect(mocks.updateBranding).not.toHaveBeenCalled();
  });

  it("does not POST, merge, publish, or toast when unmounted during deferred native image decoding", async () => {
    vi.mocked(fetchBrandingSettings).mockResolvedValueOnce(populatedBranding);
    let resolveDecode!: (bitmap: ImageBitmap) => void;
    const deferredClose = vi.fn();
    globalThis.createImageBitmap = vi.fn(
      () =>
        new Promise<ImageBitmap>((resolve) => {
          resolveDecode = resolve;
        }),
    );

    const { result, unmount } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let uploadPromise!: Promise<boolean>;
    act(() => {
      uploadPromise = result.current.upload("logo", makePngFile("logo.png"));
    });
    expect(result.current.uploading).toBe("logo");

    unmount();

    let accepted = true;
    await act(async () => {
      resolveDecode({
        width: 256,
        height: 256,
        close: deferredClose,
      } as unknown as ImageBitmap);
      accepted = await uploadPromise;
    });

    expect(accepted).toBe(false);
    expect(deferredClose).toHaveBeenCalledTimes(1);
    expect(uploadBrandingAsset).not.toHaveBeenCalled();
    expect(mocks.updateBranding).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("aborts upload intent on auth/scope change during deferred decode without old finally releasing or overwriting a newer operation", async () => {
    const actorABranding: BrandingSettings = {
      ...populatedBranding,
      appName: "Actor A Workspace",
    };
    const actorBBranding: BrandingSettings = {
      ...populatedBranding,
      appName: "Actor B Workspace",
    };
    vi.mocked(fetchBrandingSettings)
      .mockResolvedValueOnce(actorABranding)
      .mockResolvedValueOnce(actorBBranding);

    let resolveActorADecode!: (bitmap: ImageBitmap) => void;
    const actorAClose = vi.fn();
    const actorBClose = vi.fn();
    globalThis.createImageBitmap = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<ImageBitmap>((resolve) => {
            resolveActorADecode = resolve;
          }),
      )
      .mockImplementationOnce(async () => ({
        width: 64,
        height: 64,
        close: actorBClose,
      }) as unknown as ImageBitmap);

    const { result, rerender } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.values.appName).toBe("Actor A Workspace");

    let actorAUpload!: Promise<boolean>;
    act(() => {
      actorAUpload = result.current.upload("logo", makePngFile("actor-a-logo.png"));
    });
    expect(result.current.uploading).toBe("logo");

    // Rotate actor/auth generation while Actor A's native decoder is still pending.
    act(() => {
      mocks.auth = makeAuthState("user-b", "gen-2", true);
      rerender();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.values.appName).toBe("Actor B Workspace");
    expect(result.current.uploading).toBeNull();

    // Start a newer Actor B icon upload whose HTTP request stays pending.
    let resolveActorBUpload!: (value: { branding: BrandingSettings; replayed: boolean }) => void;
    vi.mocked(uploadBrandingAsset).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveActorBUpload = resolve;
        }),
    );

    let actorBUpload!: Promise<boolean>;
    act(() => {
      actorBUpload = result.current.upload("icon", makePngFile("actor-b-icon.png"));
    });
    await waitFor(() => expect(uploadBrandingAsset).toHaveBeenCalledTimes(1));
    expect(result.current.uploading).toBe("icon");

    // Now resolve Actor A's stale decoder while Actor B's upload is active.
    let actorAAccepted = true;
    await act(async () => {
      resolveActorADecode({
        width: 256,
        height: 256,
        close: actorAClose,
      } as unknown as ImageBitmap);
      actorAAccepted = await actorAUpload;
    });

    // Actor A must not start a POST, merge, publish, or toast — and its finally must NOT release Actor B's lock!
    expect(actorAAccepted).toBe(false);
    expect(actorAClose).toHaveBeenCalledTimes(1);
    expect(uploadBrandingAsset).toHaveBeenCalledTimes(1);
    expect(vi.mocked(uploadBrandingAsset).mock.calls[0]?.[0]).toBe("icon");
    expect(result.current.uploading).toBe("icon");
    expect(mocks.updateBranding).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();

    // Verify Actor B's synchronous operation lock is STILL held (an overlapping upload is rejected).
    let overlapUnderActorB = true;
    await act(async () => {
      overlapUnderActorB = await result.current.upload("logo", makePngFile("overlap.png"));
    });
    expect(overlapUnderActorB).toBe(false);
    expect(uploadBrandingAsset).toHaveBeenCalledTimes(1);

    // Complete Actor B's upload cleanly.
    const savedActorB = { ...actorBBranding, hasIcon: true };
    let actorBAccepted = false;
    await act(async () => {
      resolveActorBUpload({ branding: savedActorB, replayed: false });
      actorBAccepted = await actorBUpload;
    });
    expect(actorBAccepted).toBe(true);
    expect(result.current.uploading).toBeNull();
    expect(result.current.branding?.hasIcon).toBe(true);
    expect(mocks.updateBranding).toHaveBeenCalledTimes(1);
    expect(mocks.toast.success).toHaveBeenCalledTimes(1);
  });

  it("drops a stale upload HTTP completion after auth/scope changes without merging, publishing, or toasting", async () => {
    const actorABranding: BrandingSettings = {
      ...populatedBranding,
      appName: "Actor A Brand",
      hasLogo: false,
    };
    const actorBBranding: BrandingSettings = {
      ...populatedBranding,
      appName: "Actor B Brand",
      hasLogo: false,
    };
    vi.mocked(fetchBrandingSettings)
      .mockResolvedValueOnce(actorABranding)
      .mockResolvedValueOnce(actorBBranding);

    let resolveUploadHttp!: (value: { branding: BrandingSettings; replayed: boolean }) => void;
    vi.mocked(uploadBrandingAsset).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUploadHttp = resolve;
        }),
    );

    const { result, rerender } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let uploadPromise!: Promise<boolean>;
    act(() => {
      uploadPromise = result.current.upload("logo", makePngFile("logo.png"));
    });
    await waitFor(() => expect(uploadBrandingAsset).toHaveBeenCalledTimes(1));

    // Change scope/permissions before HTTP upload resolves.
    act(() => {
      mocks.canManage = false;
      mocks.auth = makeAuthState("user-b", "gen-2", false);
      rerender();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.values.appName).toBe("Actor B Brand");

    let accepted = true;
    await act(async () => {
      resolveUploadHttp({
        branding: { ...actorABranding, appName: "Stale Actor A Upload", hasLogo: true },
        replayed: false,
      });
      accepted = await uploadPromise;
    });

    expect(accepted).toBe(false);
    expect(result.current.values.appName).toBe("Actor B Brand");
    expect(result.current.branding?.hasLogo).toBe(false);
    expect(result.current.assetVersion).toBe(0);
    expect(mocks.updateBranding).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });
});

describe("branding dirty state, discard, reload, upload failures and load errors", () => {
  it("disables Save on clean or whitespace-only state, blocks invalid hex, and guards dirty Discard until confirmed", async () => {
    vi.mocked(fetchBrandingSettings).mockResolvedValueOnce(populatedBranding);
    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isDirty).toBe(false);
    expect(result.current.canSave).toBe(false);
    expect(result.current.canDiscard).toBe(false);
    expect(result.current.isDiscardOpen).toBe(false);

    await act(async () => {
      await result.current.save();
    });
    expect(fetchBrandingSettings).toHaveBeenCalledTimes(1);
    expect(updateBrandingSettings).not.toHaveBeenCalled();

    act(() => result.current.setValue({ appName: "  Acme Workspace  " }));
    expect(result.current.isDirty).toBe(false);
    expect(result.current.canSave).toBe(false);
    expect(result.current.canDiscard).toBe(true);

    act(() => result.current.discard());
    expect(result.current.isDiscardOpen).toBe(false);
    expect(result.current.values.appName).toBe("Acme Workspace");

    act(() => result.current.setValue({ appName: "Mersany Cloud", primaryColor: "not-a-color" }));
    expect(result.current.isDirty).toBe(true);
    expect(result.current.isValid).toBe(false);
    expect(result.current.canSave).toBe(false);
    expect(result.current.canDiscard).toBe(true);

    act(() => result.current.discard());
    expect(result.current.isDiscardOpen).toBe(true);
    expect(result.current.values.appName).toBe("Mersany Cloud");
    expect(result.current.values.primaryColor).toBe("not-a-color");

    act(() => result.current.cancelDiscard());
    expect(result.current.isDiscardOpen).toBe(false);
    expect(result.current.values.appName).toBe("Mersany Cloud");
    expect(result.current.values.primaryColor).toBe("not-a-color");

    act(() => result.current.discard());
    expect(result.current.isDiscardOpen).toBe(true);
    act(() => result.current.confirmDiscard());
    expect(result.current.isDiscardOpen).toBe(false);
    expect(result.current.values.appName).toBe("Acme Workspace");
    expect(result.current.values.primaryColor).toBe("#2563eb");
    expect(result.current.canSave).toBe(false);
    expect(result.current.canDiscard).toBe(false);
  });

  it("reloads immediately when clean, prompts before reloading dirty edits, and ignores discard/reload while saving", async () => {
    vi.mocked(fetchBrandingSettings)
      .mockResolvedValueOnce(populatedBranding)
      .mockResolvedValueOnce(populatedBranding);
    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.reload());
    expect(result.current.isDiscardOpen).toBe(false);
    await waitFor(() => expect(fetchBrandingSettings).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    act(() => result.current.setValue({ appName: "Draft Workspace" }));
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.reload());
    expect(result.current.isDiscardOpen).toBe(true);
    expect(fetchBrandingSettings).toHaveBeenCalledTimes(2);

    act(() => result.current.cancelDiscard());
    expect(result.current.isDiscardOpen).toBe(false);
    expect(result.current.values.appName).toBe("Draft Workspace");
    expect(fetchBrandingSettings).toHaveBeenCalledTimes(2);

    vi.mocked(fetchBrandingSettings).mockResolvedValueOnce({
      ...populatedBranding,
      appName: "Server Reloaded Workspace",
    });
    act(() => result.current.reload());
    expect(result.current.isDiscardOpen).toBe(true);
    act(() => result.current.confirmDiscard());
    await waitFor(() => expect(result.current.values.appName).toBe("Server Reloaded Workspace"));
    expect(fetchBrandingSettings).toHaveBeenCalledTimes(3);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isDiscardOpen).toBe(false);

    let resolveFreshRead!: (value: BrandingSettings) => void;
    vi.mocked(fetchBrandingSettings).mockImplementationOnce(
      () =>
        new Promise<BrandingSettings>((resolve) => {
          resolveFreshRead = resolve;
        }),
    );
    vi.mocked(updateBrandingSettings).mockResolvedValueOnce({
      ...populatedBranding,
      appName: "Saved Workspace",
    });

    act(() => result.current.setValue({ appName: "Saved Workspace" }));
    let savePromise!: Promise<void>;
    act(() => {
      savePromise = result.current.save();
    });
    expect(result.current.isSaving).toBe(true);
    expect(result.current.canDiscard).toBe(false);

    act(() => {
      result.current.discard();
      result.current.reload();
    });
    expect(result.current.isDiscardOpen).toBe(false);
    expect(result.current.values.appName).toBe("Saved Workspace");

    await act(async () => {
      resolveFreshRead({ ...populatedBranding, appName: "Server Reloaded Workspace" });
      await savePromise;
    });
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isDiscardOpen).toBe(false);
  });

  it("uploads assets with a UUIDv7 key, preserves draft metadata across discard, and maps per-kind server upload errors", async () => {
    vi.mocked(fetchBrandingSettings).mockResolvedValueOnce(populatedBranding);
    vi.mocked(uploadBrandingAsset).mockResolvedValueOnce({
      branding: { ...populatedBranding, hasLogo: true },
      replayed: false,
    });

    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setValue({ tabTitle: "Unsaved Tab" }));
    const file = makePngFile("logo.png");
    await act(async () => {
      await result.current.upload("logo", file);
    });

    const [, , idempotencyKey] = vi.mocked(uploadBrandingAsset).mock.calls[0];
    expect(isUUIDv7(idempotencyKey)).toBe(true);
    expect(result.current.branding?.hasLogo).toBe(true);
    expect(result.current.assetVersion).toBe(1);
    expect(result.current.values.tabTitle).toBe("Unsaved Tab");

    act(() => result.current.discard());
    expect(result.current.isDiscardOpen).toBe(true);
    act(() => result.current.confirmDiscard());
    expect(result.current.branding?.hasLogo).toBe(true);
    expect(result.current.assetVersion).toBe(1);
    expect(result.current.values.tabTitle).toBe("Acme");

    for (const [kind, failure, expectedMessage] of [
      ["icon", apiError(413), "Icon must be 512 KB or smaller."],
      ["logo", apiError(413), "Logo must be 2 MB or smaller."],
      ["icon", apiError(415), en.coreBilling.brandingFileTypeUnsupported],
      [
        "icon",
        apiError(400, { message: BRANDING_FILE_INVALID_CODE }),
        en.coreSettings.brandingUi.fileInvalid,
      ],
      [
        "icon",
        apiError(400, { errorCode: BRANDING_FILE_REQUIRED_CODE }),
        en.coreBilling.brandingFileRequired,
      ],
      [
        "icon",
        apiError(503, { errorCode: BRANDING_STORAGE_UNAVAILABLE_CODE }),
        en.coreBilling.brandingStorageUnavailable,
      ],
    ] as const) {
      vi.mocked(uploadBrandingAsset).mockRejectedValueOnce(failure);
      await act(async () => {
        await result.current.upload(kind, file);
      });
      expect(result.current.uploadError[kind]).toBe(expectedMessage);
      expect(result.current.assetVersion).toBe(1);
    }
  });

  it("formats actionable localized load errors with correlationId and marks 403 as denied", async () => {
    const correlationId = "01960000-0000-7000-8000-000000000099";
    vi.mocked(fetchBrandingSettings).mockRejectedValueOnce(
      apiError(500, {
        errorCode: "UNEXPECTED_FAILURE",
        message: "Raw backend English stack message",
        correlationId,
      }),
    );

    const { result } = renderHook(useBranding);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isDenied).toBe(false);
    expect(result.current.loadErrorDescription).toContain(en.coreIdentity.errors.UNKNOWN);
    expect(result.current.loadErrorDescription).toContain(correlationId);
    expect(result.current.loadErrorDescription).not.toBe(correlationId);
    expect(result.current.loadErrorDescription).not.toContain("Raw backend English stack message");

    vi.mocked(fetchBrandingSettings).mockRejectedValueOnce(apiError(403));
    act(() => result.current.reload());
    expect(result.current.isDiscardOpen).toBe(false);
    await waitFor(() => expect(result.current.isDenied).toBe(true));
    expect(result.current.loadErrorDescription).toBeUndefined();
  });
});
