import { describe, expect, it } from "vitest";
import {
  PURCHASE_ORDER_REASON_REQUIRED,
  parsePurchaseOrder,
  purchaseOrderLadder,
  type PurchaseOrder,
} from "./purchase-order-contract";

const MAKER = "01890000-0000-7000-8000-0000000000aa";
const CHECKER = "01890000-0000-7000-8000-0000000000bb";
const UUID = "01890000-0000-7000-8000-000000000001";

const raw = {
  id: UUID,
  version: 1,
  companyId: UUID,
  branchId: UUID,
  partyId: UUID,
  contactPartyId: null,
  currencyCode: "EGP",
  businessDate: "2026-08-31",
  lifecycleStatus: "DRAFT",
  approvalStatus: "NOT_REQUIRED",
  fulfillmentStatus: "UNPLANNED",
  billingStatus: "NOT_BILLED",
  grandTotal: "100",
  documentNumber: null,
  draftReference: null,
  partySnapshot: {},
  createdBy: MAKER,
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
  dispatchStatus: "NOT_REQUESTED",
  supplierAccountId: UUID,
  receivingNodeId: UUID,
  totalsSnapshot: null,
};

const everything = () => true;
const order = (over: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  ...parsePurchaseOrder(raw),
  ...over,
});

describe("the purchase-order approval ladder", () => {
  it("offers submit only on a draft that has not been submitted", () => {
    expect(purchaseOrderLadder(order(), MAKER, everything).submit).toBe(true);
    expect(purchaseOrderLadder(order({ approvalStatus: "PENDING" }), MAKER, everything).submit).toBe(
      false,
    );
  });

  it("lets only the person who raised the order withdraw it", () => {
    const pending = order({ approvalStatus: "PENDING" });
    expect(purchaseOrderLadder(pending, MAKER, everything).withdraw).toBe(true);
    expect(purchaseOrderLadder(pending, CHECKER, everything).withdraw).toBe(false);
  });

  it("stops that same person approving or rejecting it", () => {
    const pending = order({ approvalStatus: "PENDING" });
    expect(purchaseOrderLadder(pending, MAKER, everything).approve).toBe(false);
    expect(purchaseOrderLadder(pending, MAKER, everything).reject).toBe(false);
    expect(purchaseOrderLadder(pending, CHECKER, everything).approve).toBe(true);
    expect(purchaseOrderLadder(pending, CHECKER, everything).reject).toBe(true);
  });

  it("allows confirm on APPROVED and on NOT_REQUIRED, and on nothing else", () => {
    expect(purchaseOrderLadder(order({ approvalStatus: "APPROVED" }), MAKER, everything).confirm).toBe(
      true,
    );
    expect(purchaseOrderLadder(order(), MAKER, everything).confirm).toBe(true);
    expect(purchaseOrderLadder(order({ approvalStatus: "PENDING" }), MAKER, everything).confirm).toBe(
      false,
    );
    // A REJECTED order cannot be confirmed and cannot be re-submitted; the only
    // exit is cancel.
    const rejected = order({ approvalStatus: "REJECTED" });
    const ladder = purchaseOrderLadder(rejected, MAKER, everything);
    expect(ladder.confirm).toBe(false);
    expect(ladder.submit).toBe(false);
    expect(ladder.cancel).toBe(true);
  });

  it("stops offering anything but nothing once cancelled", () => {
    const cancelled = order({ lifecycleStatus: "CANCELLED" });
    expect(purchaseOrderLadder(cancelled, MAKER, everything).cancel).toBe(false);
    expect(purchaseOrderLadder(cancelled, MAKER, everything).confirm).toBe(false);
  });

  it("hides an action the actor has no grant for", () => {
    const noGrants = () => false;
    expect(purchaseOrderLadder(order(), MAKER, noGrants).submit).toBe(false);
  });

  it("requires a reason on reject as well as cancel", () => {
    // `PurchaseActionDto` marks both fields optional and the service then
    // refuses `reject` without a `reasonCode` — as a 409, not a 400.
    expect([...PURCHASE_ORDER_REASON_REQUIRED]).toEqual(["reject", "cancel"]);
  });
});

describe("parsePurchaseOrder", () => {
  it("carries the dispatch axis the contract page omits", () => {
    expect(parsePurchaseOrder(raw).dispatchStatus).toBe("NOT_REQUESTED");
  });

  it("keeps a null totals snapshot, which means the order cannot be printed", () => {
    expect(parsePurchaseOrder(raw).totalsSnapshot).toBeNull();
  });
});
