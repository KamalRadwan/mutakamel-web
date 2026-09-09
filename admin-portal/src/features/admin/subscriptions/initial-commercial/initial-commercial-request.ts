import { array, contractFailure, integer, object, oneOf, optional, record, uuid, uuid7 } from "@/shared/api/commercial-contract";
import type { InitialQuoteView, OriginalInitialSeedReceipt } from "../initial-commercial-readers";

export const INITIAL_COMMAND_MAX_BYTES = 256 * 1024;
const child = object({ selectionKey: uuid7, addonId: uuid7, definitionVersionId: uuid7, seats: integer(1, 100000) });
const application = object({ selectionKey: uuid7, applicationId: uuid, tierId: uuid, seats: integer(1, 100000), addons: array(child) });
const termsFields = { billingCycle: oneOf(["MONTHLY", "ANNUAL"]), currencyCode: oneOf(["USD"]),
  trialDays: optional(integer(1, 365)), applications: array(application) };
const terms = object(termsFields);
const creationQuote = object({ ...termsFields, purpose: oneOf(["TENANT_CREATION"]) });
const seedQuote = object({ ...termsFields, purpose: oneOf(["INITIAL_SEED"]), targetTenantId: uuid });
const seed = object({ ...termsFields, quoteId: uuid7 });
export type InitialCommercialTerms = Omit<ReturnType<typeof terms>, "trialDays"> & { trialDays?: number };
export type InitialQuoteRequest = InitialCommercialTerms & ({ purpose: "TENANT_CREATION" } | { purpose: "INITIAL_SEED"; targetTenantId: string });
export type InitialSeedRequest = InitialCommercialTerms & { quoteId: string };
export type InitialApplicationSelection = InitialCommercialTerms["applications"][number];
export const isInitialSeatQuantity = (value: number, parent = 100000) => Number.isInteger(value) && value >= 1 && value <= Math.min(parent, 100000);

function unique(values: string[]) { if (new Set(values).size !== values.length) contractFailure(); }
function validateTerms<T extends InitialCommercialTerms>(value: T, maxApplications: number, allowEmpty = false): T {
  const children = value.applications.flatMap(item => item.addons);
  if (!allowEmpty && !value.applications.length || value.applications.length > maxApplications || children.length > 100
    || value.applications.some(item => item.addons.some(addon => addon.seats > item.seats))) contractFailure();
  unique([...value.applications, ...children].map(item => item.selectionKey));
  unique(value.applications.map(item => item.applicationId));
  unique(children.map(item => item.addonId));
  return value;
}
function bounded<T>(value: T): T {
  if (new TextEncoder().encode(JSON.stringify(value)).length > INITIAL_COMMAND_MAX_BYTES) contractFailure();
  return value;
}

export function readInitialTerms(value: unknown, maxApplications = 100): InitialCommercialTerms {
  return bounded(validateTerms(terms(value), maxApplications));
}
/** An empty editor is valid locally; every transport still requires at least one application. */
export function readInitialDraftTerms(value: unknown, maxApplications = 100): InitialCommercialTerms {
  return bounded(validateTerms(terms(value), maxApplications, true));
}
export function readInitialQuoteRequest(value: unknown): InitialQuoteRequest {
  const purpose = record(value).purpose;
  if (purpose !== "TENANT_CREATION" && purpose !== "INITIAL_SEED") contractFailure();
  return bounded(validateTerms(purpose === "TENANT_CREATION" ? creationQuote(value) : seedQuote(value), purpose === "TENANT_CREATION" ? 50 : 100));
}
export function readInitialSeedRequest(value: unknown): InitialSeedRequest {
  return bounded(validateTerms(seed(value), 100));
}

/** Selection identity comparison only. Prices remain the accepted owner evidence. */
export function assertQuoteMatchesRequest(quote: InitialQuoteView, request: InitialQuoteRequest): InitialQuoteView {
  if (quote.purpose !== request.purpose || quote.targetTenantId !== (request.purpose === "INITIAL_SEED" ? request.targetTenantId : null)
    || quote.billingCycle !== request.billingCycle || quote.currencyCode !== request.currencyCode
    || request.trialDays !== undefined && quote.resolvedTrialDays !== request.trialDays
    || quote.items.length !== request.applications.length) contractFailure();
  for (const selection of request.applications) {
    const item = quote.items.find(item => item.selectionKey === selection.selectionKey);
    if (!item || item.applicationId !== selection.applicationId || item.tierId !== selection.tierId || item.seats !== selection.seats
      || item.addons.length !== selection.addons.length) contractFailure();
    for (const chosen of selection.addons) {
      const addon = item.addons.find(addon => addon.selectionKey === chosen.selectionKey);
      if (!addon || addon.addonId !== chosen.addonId || addon.definitionVersionId !== chosen.definitionVersionId || addon.seats !== chosen.seats) contractFailure();
    }
  }
  return quote;
}

export function buildInitialSeedRequest(quote: InitialQuoteView, request: InitialQuoteRequest): InitialSeedRequest {
  assertQuoteMatchesRequest(quote, request);
  if (request.purpose !== "INITIAL_SEED") contractFailure();
  return readInitialSeedRequest({ quoteId: quote.quoteId, billingCycle: request.billingCycle,
    currencyCode: request.currencyCode, applications: request.applications,
    ...(request.trialDays === undefined ? {} : { trialDays: request.trialDays }),
  });
}

/** Commercial subshape only; never a complete tenant-create DTO or provisioning intent. */
export function creationCommercialFields(quote: InitialQuoteView, request: InitialQuoteRequest) {
  assertQuoteMatchesRequest(quote, request);
  if (request.purpose !== "TENANT_CREATION") contractFailure();
  return { quoteId: quote.quoteId, subscription: {
    billingCycle: request.billingCycle, currencyCode: request.currencyCode, applications: request.applications,
    ...(request.trialDays === undefined ? {} : { trialDays: request.trialDays }),
  } };
}

export function assertSeedMatchesQuote(receipt: OriginalInitialSeedReceipt, quote: InitialQuoteView): OriginalInitialSeedReceipt {
  if (quote.purpose !== "INITIAL_SEED" || receipt.tenantId !== quote.targetTenantId || receipt.quoteId !== quote.quoteId
    || receipt.billingCycle !== quote.billingCycle || receipt.currencyCode !== quote.currencyCode || receipt.trialDays !== quote.resolvedTrialDays
    || receipt.selections.length !== quote.items.length
    || Object.keys(quote.totals).some(key => receipt.totals[key as keyof typeof quote.totals] !== quote.totals[key as keyof typeof quote.totals])) contractFailure();
  for (const expected of quote.items) {
    const item = receipt.selections.find(item => item.selectionKey === expected.selectionKey);
    if (!item || item.applicationId !== expected.applicationId || item.addons.length !== expected.addons.length) contractFailure();
    for (const expectedAddon of expected.addons) {
      const addon = item.addons.find(addon => addon.selectionKey === expectedAddon.selectionKey);
      if (!addon || addon.addonId !== expectedAddon.addonId || addon.definitionVersionId !== expectedAddon.definitionVersionId) contractFailure();
    }
  }
  return receipt;
}
