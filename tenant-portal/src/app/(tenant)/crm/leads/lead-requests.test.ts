import { beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { LEAD_STAGES_PATH } from "../lead-stages/lead-stage-contract";
import { readLeadStageCatalogue } from "../shared/lead-stage-catalogue";
import { leadPath } from "./lead-contract";
import { fetchLeadDetail } from "./lead-requests";

vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get: vi.fn() } }));

const ID = "01900100-0000-7000-8000-000000000001";
const OTHER_ID = "01900100-0000-7000-8000-000000000002";
const STAGE_ID = "01900100-0000-7000-8000-000000000010";
const LEAD = {
  id: ID,
  branchId: OTHER_ID,
  partyId: OTHER_ID,
  leadProfileType: "CORPORATE",
  stageId: STAGE_ID,
  stageFlag: "NEW",
  status: "OPEN",
  displayName: "Acme Trading",
  contacts: [
    { partyId: OTHER_ID, relationshipId: null, displayName: "Noura", isPrimary: true },
    { partyId: STAGE_ID, relationshipId: null, displayName: "Omar", isPrimary: false },
  ],
  rating: 3,
  cardColor: null,
  stageEnteredAt: "2026-10-18T08:00:00.000Z",
  createdAt: "2026-10-18T08:00:00.000Z",
  updatedAt: "2026-10-18T08:00:00.000Z",
};
const STAGE = {
  id: STAGE_ID,
  nameAr: "جديد",
  nameEn: "New",
  flag: "NEW",
  category: "IN_PROGRESS",
  sortOrder: 1,
  isDefault: true,
  isActive: true,
};

function response(data: unknown) {
  return { data, status: 200, statusText: "OK", headers: new Headers() };
}

beforeEach(() => vi.resetAllMocks());

describe("shared lead reads", () => {
  it("reads validated detail and optional card fields with the bounded, abortable request", async () => {
    const signal = new AbortController().signal;
    vi.mocked(axiosClient.get).mockResolvedValue(response(LEAD));

    const result = await fetchLeadDetail(ID, signal);

    expect(axiosClient.get).toHaveBeenCalledExactlyOnceWith(leadPath(ID), {
      signal, cache: "no-store", maxResponseBytes: 512 * 1024,
    });
    expect(result.lead.id).toBe(ID);
    expect(result.lead.contacts.map(({ displayName }) => displayName)).toEqual(["Noura", "Omar"]);
    expect(result.card).toEqual({ rating: 3, cardColor: null, stageEnteredAt: LEAD.stageEnteredAt });
  });

  it("rejects a response belonging to another lead", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue(response({ ...LEAD, id: OTHER_ID }));
    await expect(fetchLeadDetail(ID)).rejects.toThrow("Invalid lead response.");
  });

  it("rejects malformed or Core-wrapped CRM detail", async () => {
    for (const payload of [{ ...LEAD, stageFlag: "UNKNOWN" }, { data: LEAD }]) {
      vi.mocked(axiosClient.get).mockResolvedValue(response(payload));
      await expect(fetchLeadDetail(ID)).rejects.toThrow();
    }
  });

  it("keeps valid detail when optional card fields fail validation", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue(response({ ...LEAD, rating: 99 }));
    const result = await fetchLeadDetail(ID);
    expect(result.lead.id).toBe(ID);
    expect(result.card).toBeNull();
  });

  it("reads the complete ordered stage catalogue, including inactive stages", async () => {
    const signal = new AbortController().signal;
    const inactive = { ...STAGE, id: OTHER_ID, sortOrder: 2, isDefault: false, isActive: false };
    vi.mocked(axiosClient.get).mockResolvedValue(response([inactive, STAGE]));

    await expect(readLeadStageCatalogue(signal)).resolves.toEqual([STAGE, inactive]);
    expect(axiosClient.get).toHaveBeenCalledExactlyOnceWith(LEAD_STAGES_PATH, {
      signal, cache: "no-store", maxResponseBytes: 256 * 1024,
    });
  });

  it("rejects malformed stage catalogues", async () => {
    for (const payload of [{ data: [STAGE] }, [STAGE, STAGE], [{ ...STAGE, flag: "UNKNOWN" }]]) {
      vi.mocked(axiosClient.get).mockResolvedValue(response(payload));
      await expect(readLeadStageCatalogue()).rejects.toThrow("Invalid lead stages response.");
    }
  });

  it.each([new Error("request failed"), new DOMException("aborted", "AbortError")])(
    "propagates transport failures and cancellation to callers (%s)",
    async (error) => {
      vi.mocked(axiosClient.get).mockRejectedValue(error);
      await expect(fetchLeadDetail(ID)).rejects.toBe(error);
      await expect(readLeadStageCatalogue()).rejects.toBe(error);
    },
  );
});
