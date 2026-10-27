import { describe, expect, it } from "vitest";
import {
  buildCreateChannelRequest,
  buildUpdateChannelRequest,
  EMPTY_CHANNEL_FORM,
  parseChannelDetailResponse,
  parseChannelListResponse,
  toChannelForm,
  type Channel,
} from "./channel-contract";

const CHANNEL_ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const COMPANY_ID = "01890a5d-ac96-774b-bcce-b302099a8058";
const BRANCH_ID = "01890a5d-ac96-774b-bcce-b302099a8059";

const row = {
  id: CHANNEL_ID,
  companyId: COMPANY_ID,
  code: "POS1",
  name: "Main counter",
  channelType: "POS",
  status: "ACTIVE",
  configurationProfileVersionId: null,
  version: 1,
  updatedAt: "2026-08-31T09:00:00.000Z",
};

const stored: Channel = { ...row, channelType: "POS" };

describe("buildCreateChannelRequest", () => {
  it("uppercases the code", () => {
    const request = buildCreateChannelRequest({
      ...EMPTY_CHANNEL_FORM,
      code: "pos1",
      name: " Main counter ",
      channelType: "POS",
    });
    expect(request).toEqual({ code: "POS1", name: "Main counter", channelType: "POS" });
  });

  it("rejects a code the server would answer 500 for", () => {
    expect(() =>
      buildCreateChannelRequest({ ...EMPTY_CHANNEL_FORM, code: "POS 1", name: "x" }),
    ).toThrow("CHANNEL_FORM_CODE");
  });
});

describe("buildUpdateChannelRequest", () => {
  it("never sends channelType — it cannot be changed after creation", () => {
    const request = buildUpdateChannelRequest(stored, {
      ...toChannelForm(stored),
      name: "Second counter",
    });
    expect(request).toEqual({ name: "Second counter" });
  });

  it("sends a free-text status, which is not an enum", () => {
    expect(
      buildUpdateChannelRequest(stored, { ...toChannelForm(stored), status: "INACTIVE" }),
    ).toEqual({ status: "INACTIVE" });
  });
});

describe("parseChannelListResponse", () => {
  it("reads a paginated envelope and preserves the server total", () => {
    expect(parseChannelListResponse({ items: [row], total: 201, page: 2, limit: 100 }))
      .toMatchObject({ items: [row], total: 201, page: 2, limit: 100 });
  });

  it("refuses the retired bare array shape", () => {
    expect(() => parseChannelListResponse([row])).toThrow(
      /Invalid Trade channels/u,
    );
  });

  it.each([{ total: -1 }, { page: 0 }, { limit: 101 }, { total: "1" }])(
    "rejects malformed pagination %j", (fields) => {
      expect(() => parseChannelListResponse({ items: [row], total: 1, page: 1, limit: 25, ...fields }))
        .toThrow(/Invalid Trade channels/u);
    },
  );
});

describe("parseChannelDetailResponse", () => {
  it("reads the branches the detail route spreads onto the channel", () => {
    const detail = parseChannelDetailResponse({
      ...row,
      branches: [
        {
          id: BRANCH_ID,
          channelId: CHANNEL_ID,
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          isActive: true,
          version: 1,
          updatedAt: "2026-08-31T09:00:00.000Z",
        },
      ],
    });
    expect(detail.branches[0].isActive).toBe(true);
  });

  it("refuses a detail payload with no branches array", () => {
    expect(() => parseChannelDetailResponse(row)).toThrow(/Invalid Trade channels/u);
  });
});
