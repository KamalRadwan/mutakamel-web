import { describe, expect, it } from "vitest";
import { buildUpdateTenantProfileDto } from "./tenant-profile-update";

describe("tenant profile update contract", () => {
  it("whitelists profile fields and never sends immutable storage placement", () => {
    const dto = buildUpdateTenantProfileDto({
      updatedAt: "2026-07-28T08:00:00.000Z",
      companyName: "Acme Retail Group",
      industry: "Retail",
      address: { city: "Cairo" },
      storageServerId: "019f0000-0000-7000-8000-000000000030",
      storageServer: { name: "Primary Garage Cluster" },
    } as Parameters<typeof buildUpdateTenantProfileDto>[0] & {
      storageServerId: string;
      storageServer: { name: string };
    });

    expect(dto).toEqual({
      expectedUpdatedAt: "2026-07-28T08:00:00.000Z",
      companyName: "Acme Retail Group",
      industry: "Retail",
      address: { city: "Cairo" },
    });
    expect(dto).not.toHaveProperty("storageServerId");
    expect(dto).not.toHaveProperty("storageServer");
  });
});
