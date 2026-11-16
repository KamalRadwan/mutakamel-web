// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { I18nProvider } from "@/i18n/I18nContext";
import { setLanguage } from "@/i18n/useLanguage";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import {
  PUBLIC_BRANDING_ICON_PATH,
  PUBLIC_BRANDING_LOGO_PATH,
} from "@/lib/branding/public-branding";
import {
  BRANDING_MANAGE_PERMISSION,
  BRANDING_READ_PERMISSION,
  EMPTY_BRANDING,
  fetchBrandingSettings,
  updateBrandingSettings,
  uploadBrandingAsset,
  type BrandingSettings,
} from "../branding-contract";
import BrandingSettingsPage from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: {
      permissions: [BRANDING_READ_PERMISSION, BRANDING_MANAGE_PERMISSION],
      permissionScopes: {
        [BRANDING_READ_PERMISSION]: { tenantWide: true, companyIds: [], branchIds: [] },
        [BRANDING_MANAGE_PERMISSION]: { tenantWide: true, companyIds: [], branchIds: [] },
      },
    },
  }),
}));

vi.mock("@/context/BrandingContext", () => ({
  useTenantBranding: () => ({ updateBranding: vi.fn() }),
}));

vi.mock("@/design-system", async (original) => ({
  ...(await original<typeof import("@/design-system")>()),
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    errorFromApi: vi.fn(),
    outcomeFromApi: vi.fn(() => false),
  }),
}));

vi.mock("../branding-contract", async (original) => ({
  ...(await original<typeof import("../branding-contract")>()),
  fetchBrandingSettings: vi.fn(),
  updateBrandingSettings: vi.fn(),
  uploadBrandingAsset: vi.fn(),
}));

const VALID_1X1_PNG_BYTES = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

function makePngFile(name: string, targetByteLength?: number): File {
  if (!targetByteLength || targetByteLength <= VALID_1X1_PNG_BYTES.byteLength) {
    return new File([VALID_1X1_PNG_BYTES], name, { type: "image/png" });
  }
  const padded = new Uint8Array(targetByteLength);
  padded.set(VALID_1X1_PNG_BYTES, 0);
  return new File([padded], name, { type: "image/png" });
}

const savedBranding: BrandingSettings = {
  ...EMPTY_BRANDING,
  appName: "Mersany Cloud",
  tabTitle: "Mersany Tab",
  primaryColor: "#2563eb",
  secondaryColor: "#0f766e",
  hasLogo: true,
  hasIcon: true,
};

const originalCreateImageBitmap = globalThis.createImageBitmap;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

let objectUrlSequence = 0;

beforeEach(async () => {
  vi.mocked(fetchBrandingSettings).mockReset();
  vi.mocked(updateBrandingSettings).mockReset();
  vi.mocked(uploadBrandingAsset).mockReset();
  objectUrlSequence = 0;
  URL.createObjectURL = vi.fn(() => `blob:branding-asset-${++objectUrlSequence}`);
  URL.revokeObjectURL = vi.fn();
  globalThis.createImageBitmap = vi.fn(async () => ({
    width: 256,
    height: 256,
    close: vi.fn(),
  }) as unknown as ImageBitmap);
  await act(async () => {
    await setLanguage("en");
  });
});

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
  window.localStorage.removeItem("tenant_lang");
  window.localStorage.removeItem("tenant_theme");
  if (originalCreateImageBitmap) {
    globalThis.createImageBitmap = originalCreateImageBitmap;
  } else {
    Reflect.deleteProperty(globalThis, "createImageBitmap");
  }
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.clearAllMocks();
});

function renderBranding() {
  return render(
    <I18nProvider initialLanguage="en">
      <TooltipProvider>
        <BrandingSettingsPage />
      </TooltipProvider>
    </I18nProvider>,
  );
}

describe("BrandingUploadModal and BrandingPreviewModal", () => {
  it("enforces single primary button while open, rejects 620 KB icon without replacing saved asset, fences late decodes, revokes object URLs, and locks busy dismissal", async () => {
    vi.mocked(fetchBrandingSettings).mockResolvedValueOnce(savedBranding);
    renderBranding();

    await screen.findByLabelText(en.coreBilling.brandingAppName);
    const replaceButtons = screen.getAllByRole("button", {
      name: en.coreSettings.brandingUi.replaceAsset,
    });
    // Open Icon Upload Modal (second asset tile).
    fireEvent.click(replaceButtons[1]);

    const dialog = await screen.findByRole("dialog", {
      name: en.coreSettings.brandingUi.uploadIconTitle,
    });
    // PageHeader Save primary button is omitted while upload modal is open.
    expect(
      screen.queryByRole("button", { name: en.coreBilling.brandingSave }),
    ).not.toBeInTheDocument();

    const fileInput = within(dialog).getByLabelText(en.coreSettings.brandingUi.uploadIconTitle);
    const clickSpy = vi.spyOn(fileInput, "click");
    fireEvent.click(
      within(dialog).getByRole("button", { name: en.coreSettings.brandingUi.chooseFile }),
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // 620 KB icon is rejected client-side; current icon preview remains intact.
    fireEvent.change(fileInput, {
      target: { files: [makePngFile("too-large-icon.png", 620 * 1024)] },
    });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Icon must be 512 KB or smaller.",
    );
    expect(
      within(dialog).getByRole("button", { name: en.coreSettings.brandingUi.uploadAsset }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("img", { name: en.coreBilling.brandingIcon }),
    ).toHaveAttribute("src", `${PUBLIC_BRANDING_ICON_PATH}?v=0`);
    expect(URL.createObjectURL).not.toHaveBeenCalled();

    // Late decode race fence: first file decodes slowly; second file replaces it before first resolves.
    let resolveFirstDecode!: (bitmap: ImageBitmap) => void;
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    globalThis.createImageBitmap = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<ImageBitmap>((resolve) => {
            resolveFirstDecode = resolve;
          }),
      )
      .mockImplementationOnce(async () => ({
        width: 64,
        height: 64,
        close: secondClose,
      }) as unknown as ImageBitmap);

    fireEvent.change(fileInput, { target: { files: [makePngFile("slow-first.png")] } });
    fireEvent.change(fileInput, { target: { files: [makePngFile("fast-second.png")] } });

    expect(await within(dialog).findByAltText("fast-second.png")).toHaveAttribute(
      "src",
      "blob:branding-asset-1",
    );
    expect(secondClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstDecode({
        width: 512,
        height: 512,
        close: firstClose,
      } as unknown as ImageBitmap);
    });
    // First bitmap is still closed, but its stale result is ignored and never overwrites fast-second.png.
    expect(firstClose).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByAltText("fast-second.png")).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    // Replacing fast-second.png with third.png revokes blob:branding-asset-1.
    globalThis.createImageBitmap = vi.fn(async () => ({
      width: 128,
      height: 128,
      close: vi.fn(),
    }) as unknown as ImageBitmap);
    fireEvent.change(fileInput, { target: { files: [makePngFile("third.png")] } });
    expect(await within(dialog).findByAltText("third.png")).toHaveAttribute(
      "src",
      "blob:branding-asset-2",
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:branding-asset-1");

    // Server error during upload keeps modal open and retains selected file; busy state blocks Escape/Cancel.
    let rejectUpload!: (reason: unknown) => void;
    vi.mocked(uploadBrandingAsset).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectUpload = reject;
        }),
    );

    const submitButton = within(dialog).getByRole("button", {
      name: en.coreSettings.brandingUi.uploadAsset,
    });
    fireEvent.click(submitButton);

    const cancelButton = within(dialog).getByRole("button", { name: en.common.cancel });
    expect(cancelButton).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await waitFor(() => expect(uploadBrandingAsset).toHaveBeenCalledTimes(1));
    await act(async () => {
      rejectUpload(
        new TenantApiClientError("Storage down", {
          status: 503,
          statusText: "503",
          headers: new Headers(),
          data: { errorCode: "BRANDING_STORAGE_UNAVAILABLE" },
        }),
      );
    });

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      en.coreBilling.brandingStorageUnavailable,
    );
    expect(within(dialog).getByAltText("third.png")).toBeInTheDocument();

    // Closing modal revokes remaining object URL.
    fireEvent.click(within(dialog).getByRole("button", { name: en.common.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:branding-asset-2");
  });

  it("renders truthful tenant values, empty system defaults, fixed navy header, local Light/Dark toggle, contrast fallback, and non-interactive sign-in preview", async () => {
    vi.mocked(fetchBrandingSettings).mockResolvedValueOnce(savedBranding);
    const view = renderBranding();

    const appNameInput = await screen.findByLabelText(en.coreBilling.brandingAppName);
    const primaryColorInput = screen.getByLabelText(en.coreBilling.brandingPrimaryColor);

    fireEvent.click(
      screen.getByRole("button", { name: en.coreSettings.brandingUi.previewAction }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: en.coreSettings.brandingUi.previewTitle,
    });

    const previewSurface = within(dialog).getByLabelText(en.coreSettings.brandingUi.previewTitle);
    expect(previewSurface).toHaveAttribute("data-preview-theme", "light");
    expect(previewSurface).toHaveAttribute("data-preview-palette", "custom");

    // Tab title, app name, logo/icon binary URLs, and fixed Ocean Navy header.
    expect(within(dialog).getByTestId("branding-preview-tab")).toHaveTextContent("Mersany Tab");
    const header = within(dialog).getByTestId("branding-preview-header");
    expect(header).toHaveTextContent("Mersany Cloud");
    expect(header.querySelector(".bg-gradient-brand-strip")).not.toBeNull();
    expect(header.querySelector(".bg-gradient-header")).not.toBeNull();
    const images = previewSurface.querySelectorAll("img");
    expect(images.length).toBeGreaterThanOrEqual(2);
    expect(
      Array.from(images).some((img) => img.getAttribute("src") === `${PUBLIC_BRANDING_LOGO_PATH}?v=0`),
    ).toBe(true);
    expect(
      Array.from(images).some((img) => img.getAttribute("src") === `${PUBLIC_BRANDING_ICON_PATH}?v=0`),
    ).toBe(true);

    // Non-interactive sign-in preview: no real <form>, <input>, or <iframe> inside preview surface.
    expect(previewSurface.querySelector("form")).toBeNull();
    expect(previewSurface.querySelector("input")).toBeNull();
    expect(previewSurface.querySelector("iframe")).toBeNull();
    expect(within(dialog).getByTestId("branding-preview-signin")).toHaveTextContent(
      en.coreSettings.brandingUi.previewSignInAction,
    );

    // Local Dark toggle updates preview surface without mutating documentElement or localStorage.
    fireEvent.click(
      within(dialog).getByRole("radio", { name: en.coreSettings.brandingUi.previewDark }),
    );
    expect(previewSurface).toHaveAttribute("data-preview-theme", "dark");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("tenant_theme")).toBeNull();

    fireEvent.click(within(dialog).getAllByRole("button", { name: en.common.close })[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // Low-contrast draft color falls back to system palette inside preview and states why.
    fireEvent.change(appNameInput, { target: { value: "Custom Draft Brand" } });
    fireEvent.change(primaryColorInput, { target: { value: "#16a34a" } });
    fireEvent.click(
      screen.getByRole("button", { name: en.coreSettings.brandingUi.previewAction }),
    );
    const fallbackDialog = await screen.findByRole("dialog", {
      name: en.coreSettings.brandingUi.previewTitle,
    });
    const fallbackSurface = within(fallbackDialog).getByLabelText(
      en.coreSettings.brandingUi.previewTitle,
    );
    expect(fallbackSurface).toHaveAttribute("data-preview-palette", "system");
    expect(within(fallbackDialog).getByTestId("branding-preview-header")).toHaveTextContent(
      "Custom Draft Brand",
    );
    expect(
      within(fallbackDialog).getByText(en.coreBilling.brandingContrastFallback),
    ).toBeInTheDocument();
    view.unmount();

    // Uncustomized tenant (`GET {}`) renders product defaults cleanly in preview.
    vi.mocked(fetchBrandingSettings).mockResolvedValueOnce(EMPTY_BRANDING);
    renderBranding();
    await screen.findByLabelText(en.coreBilling.brandingAppName);
    fireEvent.click(
      screen.getByRole("button", { name: en.coreSettings.brandingUi.previewAction }),
    );
    const emptyDialog = await screen.findByRole("dialog", {
      name: en.coreSettings.brandingUi.previewTitle,
    });
    expect(within(emptyDialog).getByTestId("branding-preview-tab")).toHaveTextContent(
      en.common.portalName,
    );
    expect(within(emptyDialog).getByTestId("branding-preview-header")).toHaveTextContent(
      en.common.appName,
    );
    expect(
      within(emptyDialog).getByText(en.coreSettings.brandingUi.previewSystemPaletteActive),
    ).toBeInTheDocument();
  });
});
