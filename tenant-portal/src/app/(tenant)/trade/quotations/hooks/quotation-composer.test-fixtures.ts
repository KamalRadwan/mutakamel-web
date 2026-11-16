import type { QuotationComposerHandoff } from "../quotation-composer-draft";
import type { Quotation, QuotationCustomerOption, QuotationDetail } from "../quotation-contract";
import type { TradeLineDraft } from "../../documents/hooks/useTradeLineDraft";
import type { QuotationContactOption } from "../quotation-contact-contract";
import { COMPANY_SCOPE_HEADER, BRANCH_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { defaultQuotationDiscount } from "../quotation-discount-draft";

const COMPANY_ID = "01890000-0000-7000-8000-000000000001";
const BRANCH_ID = "01890000-0000-7000-8000-000000000002";
export const PARTY_ID = "01890000-0000-7000-8000-000000000003";
export const QUOTE_ID = "01890000-0000-7000-8000-000000000010";
const REV_ID = "01890000-0000-7000-8000-000000000011";
export const ITEM_ID = "01890000-0000-7000-8000-000000000020";
const UOM_ID = "01890000-0000-7000-8000-000000000021";
export const HEADERS = { [COMPANY_SCOPE_HEADER]: COMPANY_ID, [BRANCH_SCOPE_HEADER]: BRANCH_ID };
export const WORKSPACE_CURRENCIES = [
  { id: "01890000-0000-7000-8000-000000000080", code: "EGP", name: "Egyptian pound", isDefault: true, status: "ACTIVE" as const },
  { id: "01890000-0000-7000-8000-000000000081", code: "USD", name: "US dollar", isDefault: false, status: "ACTIVE" as const },
];

export const CUSTOMER_OPTION: QuotationCustomerOption = {
  partyId: PARTY_ID, partyType: "ORGANIZATION", displayName: "Delta Industrial Corp", crmCustomerProfileId: null,
  commercialAccountStatus: "ACTIVE", eligibilitySource: "ACTIVE_COMMERCIAL_ACCOUNT",
  quotationSelectable: true, denialCode: null,
};
export const CONTACT_OPTION: QuotationContactOption = {
  partyId: "01890000-0000-7000-8000-000000000004", displayName: "Contact test fixture",
  relationshipType: "CONTACT_PERSON", relationshipLabel: "Purchasing", isPrimary: true,
  email: "contact@example.test", mobile: "+201000000000", phone: null,
};

export function draftLine(): TradeLineDraft {
  return { clientLineId: "01890000-0000-7000-8000-000000000099", itemId: ITEM_ID,
    uomId: UOM_ID, quantity: "10", unitPrice: "3590.00", isPricing: false, priceError: null };
}

export const CREATED_HEADER: Quotation = {
  id: QUOTE_ID, version: 1, companyId: COMPANY_ID, branchId: BRANCH_ID, partyId: PARTY_ID,
  contactPartyId: null, currencyCode: "EGP", businessDate: "2026-10-29",
  lifecycleStatus: "DRAFT", approvalStatus: "NOT_REQUIRED", fulfillmentStatus: "UNPLANNED",
  billingStatus: "NOT_BILLED", grandTotal: "0", documentNumber: null, draftReference: "RFQ-2026",
  partySnapshot: { displayName: CUSTOMER_OPTION.displayName }, createdBy: null,
  createdAt: "2026-10-29T10:00:00.000Z", updatedAt: "2026-10-29T10:00:00.000Z",
  currentRevisionId: null, acceptedRevisionId: null, crmCustomerProfileId: null,
  customerEligibilitySource: "ACTIVE_COMMERCIAL_ACCOUNT",
};

export const DETAIL_WITH_REVISION: QuotationDetail = {
  ...CREATED_HEADER, version: 2, grandTotal: "35900.00", currentRevisionId: REV_ID,
  revisions: [{ id: REV_ID, revisionNumber: 1, status: "DRAFT", validUntil: "2099-11-15",
    grandTotal: "35900.00", subtotal: "35900.00", discountTotal: "0", pricingMode: "PROMOTIONS", discountSnapshot: {}, termsSnapshot: { paymentTermCode: "NET_30" }, sentAt: null,
    acceptedAt: null, rejectedAt: null, priceLockExpiresAt: null }],
  currentLines: [{ id: "01890000-0000-7000-8000-000000000030",
    clientLineId: draftLine().clientLineId, printLineNumber: 1, descriptionSnapshot: "Industrial Valve",
    quantity: "10", uomId: UOM_ID, unitPrice: "3590.00", lineTotal: "35900.00", discountTotal: "0", discountSnapshot: {} }],
};
export const REVISION_RESULT = { ...DETAIL_WITH_REVISION.revisions[0]!, lines: DETAIL_WITH_REVISION.currentLines };
export const REVISION_INPUT = { validUntil: "2099-11-15",
  lines: [{ clientLineId: draftLine().clientLineId, itemId: ITEM_ID, uomId: UOM_ID, quantity: "10" }],
  terms: { paymentTermCode: "NET_30" } };
export const CREATE_INPUT = { partyId: PARTY_ID, currencyCode: "EGP", draftReference: "RFQ-2026" };

export const CATALOG_ITEM = {
  id: ITEM_ID, canonicalCode: "VALVE-1", barcode: null, localizedNames: { en: "Industrial Valve" },
  quotationDescription: "Industrial Valve", salesOrderDescription: null, receiptDescription: null,
  deliveryOrderDescription: null, status: "ACTIVE", image: null,
  eligibility: { companyProfileId: "01890000-0000-7000-8000-000000000022", companyProfileVersion: 1,
    companyProfileStatus: "ACTIVE", canSell: true, canPurchase: false, canPos: false, baseUomId: UOM_ID,
    defaultSalesUomId: UOM_ID, defaultPurchaseUomId: UOM_ID,
    branchProfileId: "01890000-0000-7000-8000-000000000023",
    branchProfileVersion: 1, isAssorted: true },
};
export const CATALOG_UNIT = { id: UOM_ID, code: "EA", displayName: "Each", isBaseUom: true,
  canSell: true, canPurchase: true };

export const HANDOFF: QuotationComposerHandoff = {
  selected: CUSTOMER_OPTION, currencyCode: "SAR", draftReference: "RFQ handoff", contactPartyId: "", selectedContact: null,
  validUntil: "2099-11-15", paymentTermCode: "NET_30", incotermCode: "EXW",
  deliveryDays: "14", warrantyMonths: "12", scope: HEADERS, partialHeader: null,
  discount: defaultQuotationDiscount(),
  lineDraft: { lines: [draftLine()], items: [CATALOG_ITEM], uomsByItem: { [ITEM_ID]: [CATALOG_UNIT] } },
};
