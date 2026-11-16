import { beforeEach, describe, expect, it, vi } from "vitest";
const { patch } = vi.hoisted(() => ({ patch: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { patch } }));
import { applicationsApi } from "./applications.api";
import { readCoreBaseFeaturePolicy } from "../lib/core-base-feature-policy";
const id = "01a0edef-fd8f-70bf-892d-7e53517c0ae2";
const moduleId = "01a0edef-f984-72d6-a207-97ccc6131756";
const key = "01a0ffff-f984-72d6-a207-97ccc6131756";
const receipt = { id, moduleId, key: "core.template_designer", baseIncluded: true, baseGrantRevision: 2 };
const envelope = (data: unknown) => ({ data: { success: true, data } });
beforeEach(() => { patch.mockReset(); });

describe("standalone Core base feature policy", () => {
  it("sends only the exact policy body through the shared client with the original intent key", async () => {
    patch.mockResolvedValue(envelope(receipt));
    const body = { basePolicy: { expectedBaseGrantRevision: 1, included: true }, name: "must not be mixed", isActive: false };
    await expect(applicationsApi.updateCoreBaseFeaturePolicy(id, body, key)).resolves.toEqual(receipt);
    expect(patch).toHaveBeenCalledExactlyOnceWith(`/api/admin/core/v1/features/${id}`,
      { basePolicy: { expectedBaseGrantRevision: 1, included: true } }, { headers: { "x-idempotency-key": key } });
    expect(await applicationsApi.updateCoreBaseFeaturePolicy(id, body, key)).not.toHaveProperty("name");
  });

  it.each([
    undefined, null, {}, { ...receipt, baseIncluded: "false" }, { ...receipt, baseIncluded: undefined },
    { ...receipt, baseGrantRevision: "2" }, { ...receipt, baseGrantRevision: 0 },
    { ...receipt, baseGrantRevision: 1.5 }, { ...receipt, baseGrantRevision: 2147483648 },
    { ...receipt, key: "crm.leads" }, { ...receipt, moduleId: "core" },
  ])("never interprets malformed or absent policy metadata as excluded: %j", (value) => {
    expect(readCoreBaseFeaturePolicy(value)).toBeNull();
  });

  it.each([
    {}, { ...receipt, id: key }, { ...receipt, key: "crm.leads" },
    { ...receipt, baseIncluded: false }, { ...receipt, baseGrantRevision: 4 },
  ])("rejects an incompatible or wrong-command receipt: %j", async (value) => {
    patch.mockResolvedValue(envelope(value));
    await expect(applicationsApi.updateCoreBaseFeaturePolicy(id, { basePolicy: { expectedBaseGrantRevision: 1, included: true } }, key))
      .rejects.toThrow("Invalid Core base feature policy receipt");
  });
});
