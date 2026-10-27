import { beforeEach, describe, expect, it, vi } from "vitest";
import { readCoreData, writeCoreData } from "@/lib/api/envelope";
import {
  buildDirectorySettingsRequest,
  fetchDirectorySettings,
  saveDirectorySettings,
  toDirectorySettingsForm,
  type DirectorySettings,
} from "./directory-settings-contract";

vi.mock("@/lib/api/envelope", () => ({
  readCoreData: vi.fn(),
  writeCoreData: vi.fn(),
}));

const settings: DirectorySettings = {
  duplicateScope: "TENANT",
  preventDuplicateEmail: true,
  preventDuplicatePhone: true,
  preventDuplicateWhatsapp: true,
  maxContactMethodsPerParty: 20,
  maxAddressesPerParty: 20,
};

describe("directory settings contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads settings without a party-cache TTL", async () => {
    vi.mocked(readCoreData).mockResolvedValue(settings);

    const loaded = await fetchDirectorySettings();

    expect(loaded).toEqual(settings);
    expect(toDirectorySettingsForm(loaded)).not.toHaveProperty("partyCacheTtlSeconds");
    expect(buildDirectorySettingsRequest(loaded, toDirectorySettingsForm(loaded))).toEqual({});
  });

  it("saves only supported changed fields and accepts the TTL-free response", async () => {
    const updated = { ...settings, maxAddressesPerParty: 30, preventDuplicatePhone: false };
    vi.mocked(writeCoreData).mockResolvedValue(updated);
    const request = buildDirectorySettingsRequest(settings, {
      ...toDirectorySettingsForm(settings),
      maxAddressesPerParty: "30",
      preventDuplicatePhone: false,
    });

    expect(request).toEqual({ maxAddressesPerParty: 30, preventDuplicatePhone: false });
    await expect(saveDirectorySettings(request)).resolves.toEqual(updated);
    expect(writeCoreData).toHaveBeenCalledWith(
      "patch",
      "/api/tenant/core/v1/directory/settings",
      request,
      expect.objectContaining({ maxResponseBytes: expect.any(Number) }),
    );
  });

  it.each([0, 201, 1.5])("still rejects an invalid address limit: %s", async (limit) => {
    vi.mocked(readCoreData).mockResolvedValue({ ...settings, maxAddressesPerParty: limit });
    await expect(fetchDirectorySettings()).rejects.toThrow();
    expect(() => buildDirectorySettingsRequest(settings, {
      ...toDirectorySettingsForm(settings),
      maxAddressesPerParty: String(limit),
    })).toThrow("DIRECTORY_SETTINGS_FORM_ADDRESSES");
  });
});
