// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { I18nProvider, type Language } from "@/i18n/I18nContext";
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
} from "./branding-contract";
import BrandingSettingsPage from "./page";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
}));

const updateBrandingContext = vi.fn();
const toastMocks = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  errorFromApi: vi.fn(),
  outcomeFromApi: vi.fn(() => false),
};

const managerUser = {
  permissions: [BRANDING_READ_PERMISSION, BRANDING_MANAGE_PERMISSION],
  permissionScopes: {
    [BRANDING_READ_PERMISSION]: { tenantWide: true, companyIds: [], branchIds: [] },
    [BRANDING_MANAGE_PERMISSION]: { tenantWide: true, companyIds: [], branchIds: [] },
  },
};

const readOnlyUser = {
  permissions: [BRANDING_READ_PERMISSION],
  permissionScopes: {
    [BRANDING_READ_PERMISSION]: { tenantWide: true, companyIds: [], branchIds: [] },
  },
};

let currentUser: typeof managerUser | typeof readOnlyUser = managerUser;

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: currentUser }),
}));

vi.mock("@/context/BrandingContext", () => ({
  useTenantBranding: () => ({ updateBranding: updateBrandingContext }),
}));

vi.mock("@/design-system", async (original) => ({
  ...(await original<typeof import("@/design-system")>()),
  useToast: () => toastMocks,
}));

vi.mock("./branding-contract", async (original) => ({
  ...(await original<typeof import("./branding-contract")>()),
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

function makePngFile(name: string): File {
  return new File([VALID_1X1_PNG_BYTES], name, { type: "image/png" });
}

const initialBranding: BrandingSettings = {
  ...EMPTY_BRANDING,
  appName: "Acme Portal",
  tabTitle: "Acme Tab",
  primaryColor: "#2563eb",
  secondaryColor: "#64748b",
  hasLogo: true,
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

function dispatchAnchorClick(anchor: HTMLAnchorElement): { preventedByGuard: boolean } {
  let preventedByGuard = false;
  window.addEventListener(
    "click",
    (event) => {
      preventedByGuard = event.defaultPrevented;
      event.preventDefault();
    },
    { once: true },
  );
  act(() => {
    anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  });
  return { preventedByGuard };
}

async function renderPage(language: Language = "en") {
  await act(async () => {
    await setLanguage(language);
  });
  return render(
    <I18nProvider initialLanguage={language}>
      <TooltipProvider>
        <BrandingSettingsPage />
      </TooltipProvider>
    </I18nProvider>,
  );
}

const originalCreateImageBitmap = globalThis.createImageBitmap;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  vi.mocked(fetchBrandingSettings).mockReset();
  vi.mocked(updateBrandingSettings).mockReset();
  vi.mocked(uploadBrandingAsset).mockReset();
  routerMock.push.mockReset();
  window.history.replaceState(null, "", "/core/settings/branding");
  currentUser = managerUser;
  toastMocks.outcomeFromApi.mockReturnValue(false);
  globalThis.createImageBitmap = vi.fn(async () => ({
    width: 128,
    height: 128,
    close: vi.fn(),
  }) as unknown as ImageBitmap);
  URL.createObjectURL = vi.fn(() => "blob:branding-preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  window.localStorage.removeItem("tenant_lang");
  if (originalCreateImageBitmap) {
    globalThis.createImageBitmap = originalCreateImageBitmap;
  } else {
    Reflect.deleteProperty(globalThis, "createImageBitmap");
  }
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.clearAllMocks();
});

describe("BrandingSettingsPage", () => {
  it("prevents metadata edits while an explicit reload replaces the form", async () => {
    let complete!: (value: BrandingSettings) => void;
    vi.mocked(fetchBrandingSettings)
      .mockResolvedValueOnce(initialBranding)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      );
    await renderPage("en");
    const appName = await screen.findByLabelText(en.coreBilling.brandingAppName);
    fireEvent.click(screen.getByRole("button", { name: en.coreBilling.reload }));
    for (const input of screen.getAllByRole("textbox")) expect(input).toBeDisabled();
    await act(async () => {
      complete({ ...initialBranding, appName: "Reloaded name" });
    });
    expect(appName).toBeEnabled();
    expect(appName).toHaveValue("Reloaded name");
  });

  it("renders compact Identity, Colours, and Visual assets sections with per-kind limits, distinct hex vs contrast feedback, and linked error summary", async () => {
    vi.mocked(fetchBrandingSettings).mockResolvedValueOnce(initialBranding);
    const { container } = await renderPage("en");

    const appNameInput = await screen.findByLabelText(en.coreBilling.brandingAppName);
    expect(appNameInput).toHaveValue("Acme Portal");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(container.querySelector("aside")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.queryByText(en.coreBilling.brandingSubtitle)).not.toBeInTheDocument();

    expect(screen.getByRole("heading", { name: en.coreBilling.brandingIdentity })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: en.coreBilling.brandingColors })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: en.coreSettings.brandingUi.assetsTitle }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: en.coreBilling.brandingLogo })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: en.coreBilling.brandingIcon })).toBeInTheDocument();

    expect(screen.getByText(en.coreBilling.brandingAppName)).not.toHaveClass("sr-only");
    expect(screen.getByText(en.coreBilling.brandingTabTitle)).not.toHaveClass("sr-only");
    expect(screen.getByText(en.coreBilling.brandingPrimaryColor)).not.toHaveClass("sr-only");
    expect(screen.getByText(en.coreBilling.brandingSecondaryColor)).not.toHaveClass("sr-only");

    // Per-kind asset limit captions: logo (2 MB / 4,096) vs icon (512 KB / 1,024).
    expect(screen.getByText(/2 MB.*4,096×4,096 px/)).toBeInTheDocument();
    expect(screen.getByText(/512 KB.*1,024×1,024 px/)).toBeInTheDocument();
    expect(screen.getByText(en.coreBilling.brandingAssetImmediateHint)).toBeInTheDocument();

    const logoImage = screen.getByRole("img", { name: en.coreBilling.brandingLogo });
    expect(logoImage).toHaveAttribute("src", `${PUBLIC_BRANDING_LOGO_PATH}?v=0`);
    expect(screen.getByText(en.coreBilling.brandingNoAsset)).toBeInTheDocument();

    // Invalid hex triggers inline field error only — never the low-contrast fallback banner.
    const primaryColorInput = screen.getByLabelText(en.coreBilling.brandingPrimaryColor);
    fireEvent.change(primaryColorInput, { target: { value: "#zzzzzz" } });
    expect(screen.getAllByText(en.coreBilling.brandingColorInvalid)).toHaveLength(1);
    expect(screen.queryByText(en.coreBilling.brandingContrastFallback)).not.toBeInTheDocument();

    // Submitting via Enter while invalid focuses the linked error summary; clicking its link focuses the field.
    fireEvent.keyDown(primaryColorInput, { key: "Enter" });
    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent(en.coreSettings.brandingUi.formErrorSummary);
    await waitFor(() => expect(summary).toHaveFocus());
    const errorLink = within(summary).getByRole("link", {
      name: `${en.coreBilling.brandingPrimaryColor}: ${en.coreBilling.brandingColorInvalid}`,
    });
    fireEvent.click(errorLink);
    expect(primaryColorInput).toHaveFocus();
    expect(primaryColorInput).toHaveValue("#zzzzzz");

    // Valid hex with insufficient contrast clears the parsing error and shows the contrast fallback notice.
    fireEvent.change(primaryColorInput, { target: { value: "#16a34a" } });
    expect(screen.queryByText(en.coreBilling.brandingColorInvalid)).not.toBeInTheDocument();
    expect(await screen.findByText(en.coreBilling.brandingContrastFallback)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.coreBilling.brandingSave })).toBeEnabled();
  });

  it("guards dirty Discard, Reload, and link navigation with truthful ConfirmActionModal copy and preserves immediate modal uploads", async () => {
    let resolveFreshRead!: (value: BrandingSettings) => void;
    vi.mocked(fetchBrandingSettings)
      .mockResolvedValueOnce(initialBranding)
      .mockResolvedValueOnce(initialBranding)
      .mockResolvedValueOnce({ ...initialBranding, appName: "Reloaded Portal" })
      .mockImplementationOnce(
        () =>
          new Promise<BrandingSettings>((resolve) => {
            resolveFreshRead = resolve;
          }),
      );
    vi.mocked(updateBrandingSettings).mockResolvedValueOnce({
      ...initialBranding,
      appName: "Updated Portal",
    });
    vi.mocked(uploadBrandingAsset)
      .mockResolvedValueOnce({
        branding: { ...initialBranding, appName: "Updated Portal", hasLogo: true, hasIcon: true },
        replayed: false,
      })
      .mockResolvedValueOnce({
        branding: { ...initialBranding, appName: "Updated Portal", hasLogo: true, hasIcon: true },
        replayed: false,
      });

    await renderPage("en");
    const appNameInput = await screen.findByLabelText(en.coreBilling.brandingAppName);
    const primaryColorInput = screen.getByLabelText(en.coreBilling.brandingPrimaryColor);
    const saveButton = screen.getByRole("button", { name: en.coreBilling.brandingSave });
    const discardButton = screen.getByRole("button", { name: en.common.discardConfirm });
    const reloadButton = screen.getByRole("button", { name: en.coreBilling.reload });

    expect(saveButton).toBeDisabled();
    expect(discardButton).toBeDisabled();

    fireEvent.click(reloadButton);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(fetchBrandingSettings).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(reloadButton).toBeEnabled());

    fireEvent.change(primaryColorInput, { target: { value: "#zzzzzz" } });
    expect(saveButton).toBeDisabled();
    expect(discardButton).toBeEnabled();

    fireEvent.click(discardButton);
    const discardDialog = screen.getByRole("alertdialog", { name: en.common.discardTitle });
    expect(
      within(discardDialog).getByText(en.coreSettings.brandingUi.discardDescription),
    ).toBeInTheDocument();
    fireEvent.click(
      within(discardDialog).getByRole("button", {
        name: en.coreSettings.brandingUi.discardKeepEditing,
      }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(primaryColorInput).toHaveValue("#zzzzzz");

    fireEvent.click(discardButton);
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: en.common.discardConfirm,
      }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(primaryColorInput).toHaveValue("#2563eb");
    expect(saveButton).toBeDisabled();
    expect(discardButton).toBeDisabled();

    fireEvent.change(appNameInput, { target: { value: "Draft Portal" } });
    fireEvent.click(reloadButton);
    const reloadDialog = screen.getByRole("alertdialog", { name: en.common.discardTitle });
    expect(fetchBrandingSettings).toHaveBeenCalledTimes(2);
    fireEvent.click(
      within(reloadDialog).getByRole("button", {
        name: en.coreSettings.brandingUi.discardKeepEditing,
      }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(appNameInput).toHaveValue("Draft Portal");
    expect(fetchBrandingSettings).toHaveBeenCalledTimes(2);

    fireEvent.click(reloadButton);
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: en.common.discardConfirm,
      }),
    );
    await waitFor(() => expect(appNameInput).toHaveValue("Reloaded Portal"));
    expect(fetchBrandingSettings).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    fireEvent.change(appNameInput, { target: { value: "Updated Portal" } });
    const navLink = document.createElement("a");
    navLink.href = "/core/settings/workspace";
    document.body.appendChild(navLink);
    try {
      expect(dispatchAnchorClick(navLink).preventedByGuard).toBe(true);
      const navDialog = await screen.findByRole("alertdialog", {
        name: en.common.discardTitle,
      });
      fireEvent.click(
        within(navDialog).getByRole("button", {
          name: en.coreSettings.brandingUi.discardKeepEditing,
        }),
      );
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(routerMock.push).not.toHaveBeenCalled();
      expect(appNameInput).toHaveValue("Updated Portal");
    } finally {
      navLink.remove();
    }

    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);
    expect(discardButton).toBeDisabled();
    expect(reloadButton).toBeDisabled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await act(async () => {
      resolveFreshRead({ ...initialBranding, appName: "Reloaded Portal" });
    });
    await waitFor(() =>
      expect(updateBrandingSettings).toHaveBeenCalledWith({ appName: "Updated Portal" }),
    );
    await waitFor(() => expect(saveButton).toBeDisabled());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    // First icon upload via centered Upload Modal.
    fireEvent.click(
      screen.getByRole("button", { name: en.coreSettings.brandingUi.uploadAsset }),
    );
    let dialog = await screen.findByRole("dialog", {
      name: en.coreSettings.brandingUi.uploadIconTitle,
    });
    fireEvent.change(
      within(dialog).getByLabelText(en.coreSettings.brandingUi.uploadIconTitle),
      { target: { files: [makePngFile("icon-1.png")] } },
    );
    const confirmUploadButton = await within(dialog).findByRole("button", {
      name: en.coreSettings.brandingUi.uploadAsset,
    });
    await waitFor(() => expect(confirmUploadButton).toBeEnabled());
    fireEvent.click(confirmUploadButton);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("img", { name: en.coreBilling.brandingIcon })).toHaveAttribute(
      "src",
      `${PUBLIC_BRANDING_ICON_PATH}?v=1`,
    );

    // Replacement icon upload via centered Upload Modal ("Replace image").
    const replaceButtons = screen.getAllByRole("button", {
      name: en.coreSettings.brandingUi.replaceAsset,
    });
    fireEvent.click(replaceButtons[1]);
    dialog = await screen.findByRole("dialog", {
      name: en.coreSettings.brandingUi.uploadIconTitle,
    });
    fireEvent.change(
      within(dialog).getByLabelText(en.coreSettings.brandingUi.uploadIconTitle),
      { target: { files: [makePngFile("icon-2.png")] } },
    );
    const secondConfirm = await within(dialog).findByRole("button", {
      name: en.coreSettings.brandingUi.uploadAsset,
    });
    await waitFor(() => expect(secondConfirm).toBeEnabled());
    fireEvent.click(secondConfirm);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("img", { name: en.coreBilling.brandingIcon })).toHaveAttribute(
      "src",
      `${PUBLIC_BRANDING_ICON_PATH}?v=2`,
    );

    // Discarding unsaved metadata never undoes the uploaded icon.
    fireEvent.change(appNameInput, { target: { value: "Unsaved After Upload" } });
    fireEvent.click(discardButton);
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: en.common.discardConfirm,
      }),
    );
    expect(appNameInput).toHaveValue("Updated Portal");
    expect(screen.getByRole("img", { name: en.coreBilling.brandingIcon })).toHaveAttribute(
      "src",
      `${PUBLIC_BRANDING_ICON_PATH}?v=2`,
    );
  });

  it("renders read-only values at full contrast without mutation actions when branding.manage is absent", async () => {
    currentUser = readOnlyUser;
    vi.mocked(fetchBrandingSettings).mockResolvedValueOnce(initialBranding);

    await renderPage("en");
    const appNameInput = await screen.findByLabelText(en.coreBilling.brandingAppName);
    expect(appNameInput).toHaveValue("Acme Portal");
    expect(appNameInput).toHaveAttribute("readonly");
    expect(appNameInput).not.toBeDisabled();
    expect(screen.getByText(en.coreBilling.brandingReadOnlyNotice)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.coreBilling.brandingSave }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.coreSettings.brandingUi.replaceAsset }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.coreSettings.brandingUi.uploadAsset }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.coreSettings.brandingUi.previewAction }),
    ).toBeEnabled();
  });

  it("renders actionable localized ErrorState on load failure, retries without prompt, shows PermissionGate on 403, and renders Arabic RTL labels", async () => {
    const correlationId = "01960000-0000-7000-8000-000000000055";
    vi.mocked(fetchBrandingSettings).mockRejectedValueOnce(
      apiError(500, { errorCode: "SERVER_DOWN", correlationId }),
    );

    const view = await renderPage("en");
    expect(await screen.findByText(en.coreBilling.brandingLoadFailed)).toBeInTheDocument();
    const referenceLine = screen.getByText((text) => text.includes(correlationId));
    expect(referenceLine.textContent).toContain(en.coreIdentity.errors.UNKNOWN);
    expect(referenceLine.textContent).not.toBe(correlationId);

    vi.mocked(fetchBrandingSettings).mockRejectedValueOnce(apiError(403));
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(await screen.findByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByText(en.coreBilling.brandingReadOnlyNotice)).not.toBeInTheDocument();
    view.unmount();

    vi.mocked(fetchBrandingSettings).mockResolvedValueOnce(initialBranding);
    await renderPage("ar");
    expect(await screen.findByLabelText(ar.coreBilling.brandingAppName)).toHaveValue("Acme Portal");
    expect(screen.getByRole("heading", { name: ar.coreBilling.brandingIdentity })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: ar.coreBilling.brandingColors })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: ar.coreSettings.brandingUi.assetsTitle }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: ar.coreBilling.brandingLogo })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: ar.coreBilling.brandingIcon })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(ar.coreSettings.brandingUi.kilobytes))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ar.coreBilling.brandingSave })).toBeDisabled();
    expect(screen.getByRole("button", { name: ar.common.discardConfirm })).toBeDisabled();
  });
});
