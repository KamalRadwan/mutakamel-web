import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { readCoreData } from "@/lib/api/envelope";
import { corePost, corePut } from "../../core-api";
import {
  BRANDING_FORM_COLOR_ERROR,
  BRANDING_FORM_TEXT_ERROR,
  buildUpdateBrandingRequest,
  EMPTY_BRANDING,
  fetchBrandingSettings,
  hasBrandingDraftEdits,
  hasBrandingMetadataChanges,
  isValidBrandingHexColor,
  mergeUploadedBranding,
  toBrandingForm,
  updateBrandingSettings,
  uploadBrandingAsset,
  validateBrandingForm,
  type BrandingFormValues,
  type BrandingSettings,
} from "./branding-contract";
import {
  BRANDING_ASSET_MIME_TYPES,
  describeBrandingAssetRejection,
  formatBrandingAssetLimits,
  formatBrandingAssetSize,
  inspectBrandingAssetFile,
} from "./branding-image-validation";

vi.mock("@/lib/api/envelope", () => ({ readCoreData: vi.fn() }));
vi.mock("../../core-api", () => ({ corePost: vi.fn(), corePut: vi.fn() }));
vi.mock("@/lib/api/outcomes", () => ({ isIdempotentReplay: () => false }));

// Genuine decodable 1×1 RGBA PNG (68 bytes: signature + IHDR + IDAT + IEND).
const VALID_1X1_PNG_BYTES = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

function makeDecodablePngFile(name = "asset.png", targetByteLength?: number): File {
  if (!targetByteLength || targetByteLength <= VALID_1X1_PNG_BYTES.byteLength) {
    return new File([VALID_1X1_PNG_BYTES], name, { type: "image/png" });
  }
  const padded = new Uint8Array(targetByteLength);
  padded.set(VALID_1X1_PNG_BYTES, 0);
  return new File([padded], name, { type: "image/png" });
}

const originalCreateImageBitmap = globalThis.createImageBitmap;
const originalImage = globalThis.Image;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

afterEach(() => {
  if (originalCreateImageBitmap) {
    globalThis.createImageBitmap = originalCreateImageBitmap;
  } else {
    Reflect.deleteProperty(globalThis, "createImageBitmap");
  }
  if (originalImage) {
    globalThis.Image = originalImage;
  } else {
    Reflect.deleteProperty(globalThis, "Image");
  }
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

const populated = {
  ...EMPTY_BRANDING,
  appName: "Workspace",
  tabTitle: "Dashboard",
  fontFamily: "Arial",
  primaryColor: "#123456",
  secondaryColor: "#abcdef",
};
const fields: (keyof BrandingFormValues)[] = [
  "appName",
  "tabTitle",
  "primaryColor",
  "secondaryColor",
];

describe("branding response contract", () => {
  it("maps an uncustomized tenant to empty settings", async () => {
    vi.mocked(readCoreData).mockResolvedValueOnce({});
    await expect(fetchBrandingSettings()).resolves.toEqual(EMPTY_BRANDING);
  });

  it.each(["read", "update", "logo", "icon"] as const)(
    "%s reads presence flags without storage keys",
    async (operation) => {
      const payload = {
        ...populated,
        hasLogo: true,
        hasIcon: false,
        logoUrl: "/api/tenant/core/v1/branding/public/logo?v=0123456789abcdef",
        iconUrl: null,
      };
      let settings: BrandingSettings;
      if (operation === "read") {
        vi.mocked(readCoreData).mockResolvedValueOnce(payload);
        settings = await fetchBrandingSettings();
      } else if (operation === "update") {
        vi.mocked(corePut).mockResolvedValueOnce({ data: payload, headers: new Headers(), status: 200 });
        settings = await updateBrandingSettings({});
      } else {
        vi.mocked(corePost).mockResolvedValueOnce({ data: payload, headers: new Headers(), status: 200 });
        settings = (
          await uploadBrandingAsset(operation, makeDecodablePngFile("asset.png"), "command-id")
        ).branding;
      }
      expect(settings).toEqual({ ...populated, hasLogo: true, hasIcon: false });
      expect(settings).not.toHaveProperty("logoStorageKey");
      expect(settings).not.toHaveProperty("iconStorageKey");
    },
  );

  it.each([
    [true, false],
    [false, true],
    [true, true],
    [false, false],
  ])("preserves logo=%s and icon=%s presence", async (hasLogo, hasIcon) => {
    vi.mocked(readCoreData).mockResolvedValueOnce({ ...populated, hasLogo, hasIcon });
    await expect(fetchBrandingSettings()).resolves.toEqual({ ...populated, hasLogo, hasIcon });
  });

  it.each([undefined, null, "true", 1])("rejects invalid presence flag %s", async (value) => {
    vi.mocked(readCoreData).mockResolvedValueOnce({ ...populated, hasLogo: value });
    await expect(fetchBrandingSettings()).rejects.toThrow("Invalid Core branding response.");
  });
});

describe("branding settings patch and upload baseline merge", () => {
  it("omits unchanged settings and loginHtml", () => {
    expect(buildUpdateBrandingRequest(toBrandingForm(populated), populated)).toEqual({});
    expect(buildUpdateBrandingRequest(toBrandingForm(EMPTY_BRANDING), EMPTY_BRANDING)).toEqual({});
  });

  it.each(fields)("serializes a reset of %s and maps cleared readback", (field) => {
    const values = { ...toBrandingForm(populated), [field]: "   " };
    const patch = buildUpdateBrandingRequest(values, populated);
    expect(patch).toEqual({ [field]: null });
    expect(JSON.stringify(patch)).toBe(JSON.stringify({ [field]: null }));
    const reloaded: BrandingSettings = { ...populated, ...patch };
    expect(toBrandingForm(reloaded)[field]).toBe("");
    expect(buildUpdateBrandingRequest(toBrandingForm(reloaded), reloaded)).toEqual({});
  });

  it("sends only edited values and never includes loginHtml", () => {
    const patch = buildUpdateBrandingRequest(
      { ...toBrandingForm(populated), appName: "New name" },
      populated,
    );
    expect(patch).toEqual({ appName: "New name" });
    expect(patch).not.toHaveProperty("loginHtml");
  });

  it("ignores font input and preserves the stored font setting", () => {
    const values = {
      ...toBrandingForm(populated),
      fontFamily: "x".repeat(121),
      appName: "New name",
    };
    expect(toBrandingForm(populated)).not.toHaveProperty("fontFamily");
    expect(validateBrandingForm(values)).toEqual({});
    const patch = buildUpdateBrandingRequest(values, populated);
    expect(patch).toEqual({ appName: "New name" });
    expect(patch).not.toHaveProperty("fontFamily");
    expect({ ...populated, ...patch }.fontFamily).toBe("Arial");
  });

  it.each(["appName", "tabTitle"] as const)("rejects overlong %s without truncation", (field) => {
    const values = { ...toBrandingForm(populated), [field]: "x".repeat(121) };
    expect(validateBrandingForm(values)[field]).toBe(BRANDING_FORM_TEXT_ERROR);
    expect(() => buildUpdateBrandingRequest(values, populated)).toThrow(BRANDING_FORM_TEXT_ERROR);
    expect(values[field]).toHaveLength(121);
    expect(
      buildUpdateBrandingRequest({ ...values, [field]: "x".repeat(120) }, populated),
    ).toEqual({ [field]: "x".repeat(120) });
  });

  it.each(["primaryColor", "secondaryColor"] as const)("validates %s before sending", (field) => {
    const values = { ...toBrandingForm(populated), [field]: "invalid" };
    expect(validateBrandingForm(values)[field]).toBe(BRANDING_FORM_COLOR_ERROR);
    expect(isValidBrandingHexColor("invalid")).toBe(false);
    expect(() => buildUpdateBrandingRequest(values, populated)).toThrow(BRANDING_FORM_COLOR_ERROR);
    for (const color of ["#abc", "#abcd", "#abcdef", "#abcdef12"]) {
      expect(isValidBrandingHexColor(color)).toBe(true);
      expect(buildUpdateBrandingRequest({ ...values, [field]: color }, EMPTY_BRANDING)[field]).toBe(
        color,
      );
    }
  });

  it("distinguishes semantic metadata changes from whitespace-only draft edits", () => {
    expect(hasBrandingMetadataChanges(toBrandingForm(populated), populated)).toBe(false);
    expect(hasBrandingDraftEdits(toBrandingForm(populated), populated)).toBe(false);
    expect(hasBrandingMetadataChanges(toBrandingForm(EMPTY_BRANDING), EMPTY_BRANDING)).toBe(false);
    expect(hasBrandingDraftEdits(toBrandingForm(EMPTY_BRANDING), EMPTY_BRANDING)).toBe(false);

    const padded = { ...toBrandingForm(populated), appName: "  Workspace  " };
    expect(hasBrandingMetadataChanges(padded, populated)).toBe(false);
    expect(hasBrandingDraftEdits(padded, populated)).toBe(true);
    expect(buildUpdateBrandingRequest(padded, populated)).toEqual({});

    const blankOnEmpty = { ...toBrandingForm(EMPTY_BRANDING), tabTitle: "   " };
    expect(hasBrandingMetadataChanges(blankOnEmpty, EMPTY_BRANDING)).toBe(false);
    expect(hasBrandingDraftEdits(blankOnEmpty, EMPTY_BRANDING)).toBe(true);

    const cleared = { ...toBrandingForm(populated), appName: "   " };
    expect(hasBrandingMetadataChanges(cleared, populated)).toBe(true);
    expect(hasBrandingDraftEdits(cleared, populated)).toBe(true);
  });

  it("retains dirty metadata and original conflict baseline across immediate asset merges", () => {
    const initial = { ...populated, hasLogo: false, hasIcon: false };
    const dirtyDraft = {
      branding: initial,
      baseline: initial,
      values: { ...toBrandingForm(initial), appName: "Local Draft", primaryColor: "#0ea5e9" },
    };
    const uploadedFromServer: BrandingSettings = {
      ...initial,
      appName: "Concurrent Remote Name",
      tabTitle: "Concurrent Remote Tab",
      hasLogo: true,
    };

    const merged = mergeUploadedBranding(dirtyDraft, uploadedFromServer);
    expect(merged.branding).toEqual(uploadedFromServer);
    expect(merged.values.appName).toBe("Local Draft");
    expect(merged.values.primaryColor).toBe("#0ea5e9");
    expect(merged.values.tabTitle).toBe("Concurrent Remote Tab");
    expect(merged.baseline?.appName).toBe("Workspace");
    expect(merged.baseline?.tabTitle).toBe("Concurrent Remote Tab");
    expect(merged.baseline?.hasLogo).toBe(true);
  });
});

describe("per-kind branding image validation and formatting", () => {
  it("matches backend per-kind limits and formats bilingual size and dimension captions", () => {
    expect(BRANDING_ASSET_MIME_TYPES).toEqual(["image/png", "image/jpeg", "image/webp"]);

    expect(formatBrandingAssetSize(2 * 1024 * 1024, en, "en")).toBe("2 MB");
    expect(formatBrandingAssetSize(512 * 1024, en, "en")).toBe("512 KB");
    expect(formatBrandingAssetSize(512 * 1024, ar, "ar")).toContain("512");
    expect(formatBrandingAssetSize(512 * 1024, ar, "ar")).toContain(ar.coreSettings.brandingUi.kilobytes);

    expect(formatBrandingAssetLimits("logo", en, "en")).toContain("2 MB");
    expect(formatBrandingAssetLimits("logo", en, "en")).toContain("4,096×4,096 px");
    expect(formatBrandingAssetLimits("icon", en, "en")).toContain("512 KB");
    expect(formatBrandingAssetLimits("icon", en, "en")).toContain("1,024×1,024 px");
  });

  it.each([
    { kind: "logo" as const, maxBytes: 2 * 1024 * 1024, maxDimension: 4096 },
    { kind: "icon" as const, maxBytes: 512 * 1024, maxDimension: 1024 },
  ])("accepts the exact $kind byte and dimension limits through native inspection", async ({ kind, maxBytes, maxDimension }) => {
    const close = vi.fn();
    globalThis.createImageBitmap = vi.fn(async () => ({
      width: maxDimension,
      height: maxDimension,
      close,
    }) as unknown as ImageBitmap);

    await expect(inspectBrandingAssetFile(kind, makeDecodablePngFile(`${kind}.png`, maxBytes))).resolves.toEqual({
      ok: true,
      width: maxDimension,
      height: maxDimension,
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("enforces stricter icon byte/dimension caps vs logo caps and closes ImageBitmap handles", async () => {
    const closeSpy = vi.fn();
    let nextBitmap = { width: 512, height: 512, close: closeSpy };
    globalThis.createImageBitmap = vi.fn(async () => nextBitmap as unknown as ImageBitmap);

    // 620 KiB passes logo (2 MiB cap) and fails icon (512 KiB cap) before decode.
    const file620Kb = makeDecodablePngFile("mark.png", 620 * 1024);
    await expect(inspectBrandingAssetFile("icon", file620Kb)).resolves.toEqual({
      ok: false,
      reason: "too-large",
    });
    expect(describeBrandingAssetRejection("icon", "too-large", en, "en")).toBe(
      "Icon must be 512 KB or smaller.",
    );
    expect(globalThis.createImageBitmap).not.toHaveBeenCalled();

    await expect(inspectBrandingAssetFile("logo", file620Kb)).resolves.toEqual({
      ok: true,
      width: 512,
      height: 512,
    });
    expect(closeSpy).toHaveBeenCalledTimes(1);

    // Logo rejects > 2 MiB.
    const fileOver2Mb = makeDecodablePngFile("huge-logo.png", 2 * 1024 * 1024 + 1);
    await expect(inspectBrandingAssetFile("logo", fileOver2Mb)).resolves.toEqual({
      ok: false,
      reason: "too-large",
    });
    expect(describeBrandingAssetRejection("logo", "too-large", en, "en")).toBe(
      "Logo must be 2 MB or smaller.",
    );

    // Icon rejects > 1024 px; logo accepts 2048 px and rejects > 4096 px.
    nextBitmap = { width: 1025, height: 512, close: closeSpy };
    const smallValidPng = makeDecodablePngFile("icon.png");
    await expect(inspectBrandingAssetFile("icon", smallValidPng)).resolves.toEqual({
      ok: false,
      reason: "dimensions-exceeded",
    });
    expect(describeBrandingAssetRejection("icon", "dimensions-exceeded", en, "en")).toBe(
      "Image dimensions must not exceed 1,024×1,024 px.",
    );

    nextBitmap = { width: 2048, height: 1024, close: closeSpy };
    await expect(inspectBrandingAssetFile("logo", smallValidPng)).resolves.toEqual({
      ok: true,
      width: 2048,
      height: 1024,
    });

    nextBitmap = { width: 4097, height: 512, close: closeSpy };
    await expect(inspectBrandingAssetFile("logo", smallValidPng)).resolves.toEqual({
      ok: false,
      reason: "dimensions-exceeded",
    });
    expect(describeBrandingAssetRejection("logo", "dimensions-exceeded", en, "en")).toBe(
      "Image dimensions must not exceed 4,096×4,096 px.",
    );
    expect(closeSpy).toHaveBeenCalledTimes(4);
  });

  it("rejects empty files, unsupported MIME types, and undecodable image bytes", async () => {
    await expect(
      inspectBrandingAssetFile("logo", new File([], "empty.png", { type: "image/png" })),
    ).resolves.toEqual({ ok: false, reason: "empty" });

    await expect(
      inspectBrandingAssetFile(
        "logo",
        new File(["<svg></svg>"], "vector.svg", { type: "image/svg+xml" }),
      ),
    ).resolves.toEqual({ ok: false, reason: "unsupported-type" });

    globalThis.createImageBitmap = vi.fn(async () => {
      throw new DOMException("Could not decode image", "EncodingError");
    });
    await expect(
      inspectBrandingAssetFile(
        "icon",
        new File([new Uint8Array([1, 2, 3, 4])], "corrupt.png", { type: "image/png" }),
      ),
    ).resolves.toEqual({ ok: false, reason: "invalid-image" });
    expect(describeBrandingAssetRejection("icon", "invalid-image", en, "en")).toBe(
      en.coreSettings.brandingUi.fileInvalid,
    );
  });

  it("falls back to HTMLImageElement decoding with object-URL cleanup and fails truthfully when no decoder exists", async () => {
    Reflect.deleteProperty(globalThis, "createImageBitmap");

    let nextNaturalSize: { width: number; height: number } | "error" = { width: 512, height: 256 };
    const createUrlSpy = vi.fn(() => "blob:branding-fallback-check");
    const revokeUrlSpy = vi.fn();
    URL.createObjectURL = createUrlSpy;
    URL.revokeObjectURL = revokeUrlSpy;

    class MockImage {
      naturalWidth = 0;
      naturalHeight = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => {
          if (nextNaturalSize === "error") {
            this.onerror?.();
            return;
          }
          this.naturalWidth = nextNaturalSize.width;
          this.naturalHeight = nextNaturalSize.height;
          this.onload?.();
        });
      }
    }
    globalThis.Image = MockImage as unknown as typeof Image;

    const validFile = makeDecodablePngFile("fallback.png");
    await expect(inspectBrandingAssetFile("icon", validFile)).resolves.toEqual({
      ok: true,
      width: 512,
      height: 256,
    });
    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrlSpy).toHaveBeenCalledWith("blob:branding-fallback-check");

    nextNaturalSize = { width: 1025, height: 512 };
    await expect(inspectBrandingAssetFile("icon", validFile)).resolves.toEqual({
      ok: false,
      reason: "dimensions-exceeded",
    });
    expect(revokeUrlSpy).toHaveBeenCalledTimes(2);

    nextNaturalSize = "error";
    await expect(inspectBrandingAssetFile("logo", validFile)).resolves.toEqual({
      ok: false,
      reason: "invalid-image",
    });
    expect(revokeUrlSpy).toHaveBeenCalledTimes(3);

    // When neither createImageBitmap nor Image exists, validation never manufactures dimensions.
    Reflect.deleteProperty(globalThis, "Image");
    await expect(inspectBrandingAssetFile("logo", validFile)).resolves.toEqual({
      ok: false,
      reason: "invalid-image",
    });
  });
});
