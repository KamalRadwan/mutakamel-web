"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { safeSessionStorage } from "@/lib/safeStorage";
import { canonicalizeDecimalInput } from "../../documents/fixed-decimal";
import { partyDisplayName, TRADE_DRAFT_REFERENCE_MAX_LENGTH } from "../../documents/trade-document-contract";
import { useTradeLineDraft } from "../../documents/hooks/useTradeLineDraft";
import type { TradeWriteState } from "../../documents/hooks/useTradeWrite";
import { validateTradeLine } from "../../documents/trade-line-validation";
import { buildCreateQuotation, buildUpdateQuotationHeader, type QuotationDetail } from "../quotation-contract";
import {
  defaultQuotationFields, hasQuotationScope, parseQuotationTerm, quotationScope, quotationScopeKey,
  readQuotationHandoff, readQuotationReplacementCreateKey, validQuotationDate, writeQuotationHandoff,
  QUOTATION_HANDOFF_STORAGE_KEY, type QuotationDraftFields, type QuotationReplacementSource,
} from "../quotation-composer-draft";
import { quotationContactMatchesCustomer, type QuotationContactOption } from "../quotation-contact-contract";
import type { QuotationDiscountDraft } from "../quotation-discount-draft";
import {
  buildHydratedCustomerOption, buildSanitizedQuotationTerms, hydrateQuotationWorkspace, quotationScopedHeaders,
  type HydratedQuotationWorkspaceData,
} from "../quotation-workspace-hydration";
import { useQuotationCatalogHydration } from "./useQuotationCatalogHydration";
import { useQuotationContacts } from "./useQuotationContacts";
import { useQuotationCurrencies } from "./useQuotationCurrencies";
import { useQuotationCustomers } from "./useQuotationCustomers";
import { useQuotationEditSave } from "./useQuotationEditSave";
import { useQuotationPricing } from "./useQuotationPricing";
import { useQuotationSave } from "./useQuotationSave";
import { useQuotationScopeProtection } from "./useQuotationScopeProtection";

export { QUOTATION_HANDOFF_STORAGE_KEY } from "../quotation-composer-draft";
export type { QuotationComposerHandoff } from "../quotation-composer-draft";

export interface QuotationComposerOptions {
  headers: Record<string, string>;
  isEnabled: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canSend: boolean;
  canReadItems?: boolean;
  hydrateHandoff?: boolean;
  replacementQuoteId?: string;
  existingQuotation?: QuotationDetail | null;
  write?: TradeWriteState;
  onReplacementReady?: (quotationId: string) => void;
  onSaved?: (detail: QuotationDetail) => Promise<unknown> | void;
}

function buildEditDraftFields(quotation: QuotationDetail, hydrated: HydratedQuotationWorkspaceData): QuotationDraftFields {
  return {
    selected: buildHydratedCustomerOption(quotation, quotation.contactPartyId ? "ORGANIZATION" : "PERSON"),
    selectedContact: null,
    currencyCode: quotation.currencyCode,
    draftReference: quotation.draftReference ?? "",
    contactPartyId: quotation.contactPartyId ?? "",
    validUntil: hydrated.validUntil,
    paymentTermCode: hydrated.terms.paymentTermCode,
    incotermCode: hydrated.terms.incotermCode,
    deliveryDays: hydrated.terms.deliveryDays,
    warrantyMonths: hydrated.terms.warrantyMonths,
    discount: hydrated.discount,
  };
}

export function useQuotationComposer(options: QuotationComposerOptions) {
  const { user, realtimeAuthGeneration, readReadyProfileCommit } = useTenantAuth();
  const { t, lang } = useI18n();
  const actorId = user?.id ?? null;
  const isEditMode = Boolean(options.existingQuotation);
  const defaultValidUntil = useMemo(() => defaultQuotationFields().validUntil, []);
  const initialEdit = useMemo(() => options.existingQuotation
    ? hydrateQuotationWorkspace(options.existingQuotation, defaultValidUntil) : null,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);
  const [baseline, setBaseline] = useState<QuotationDraftFields>(() =>
    options.existingQuotation && initialEdit ? buildEditDraftFields(options.existingQuotation, initialEdit) : defaultQuotationFields());
  const [fields, setFields] = useState<QuotationDraftFields>(() => baseline);
  const [extraTerms, setExtraTerms] = useState<Record<string, unknown>>(() => initialEdit?.terms.extraTerms ?? {});
  const [chosenEditContact, setChosenEditContact] = useState<QuotationContactOption | null>(null);
  const [replacementHandoffFailed, setReplacementHandoffFailed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [currencyTouched, setCurrencyTouched] = useState(isEditMode);
  const [handoffReady, setHandoffReady] = useState(!options.hydrateHandoff || isEditMode);
  const [replacement, setReplacement] = useState<{ source: QuotationReplacementSource; handoffId: string; context: string }>();
  const [retainedCreate, setRetainedCreate] = useState<{ key: string; context: string }>();
  const hydratedHandoff = useRef(false);
  const headersKey = JSON.stringify(Object.entries(options.headers).sort());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableHeaders = useMemo(() => options.headers, [headersKey]);
  const replacementContext = JSON.stringify([actorId, realtimeAuthGeneration, quotationScopeKey(stableHeaders), options.replacementQuoteId]);
  const replacementRequested = !isEditMode && options.replacementQuoteId !== undefined;
  const replacementSource = realtimeAuthGeneration && replacement?.context === replacementContext
    && replacement.source.quotationId === options.replacementQuoteId ? replacement.source : undefined;
  const replacementUnavailable = replacementRequested && handoffReady && !replacementSource;
  const replacementCreateKey = retainedCreate?.context === replacementContext ? retainedCreate.key : undefined;
  const editingEnabled = options.isEnabled && (!replacementRequested || Boolean(replacementSource));
  const isReplacementAuthCurrent = useCallback(() => {
    const commit = readReadyProfileCommit();
    if (!realtimeAuthGeneration || !actorId || commit?.user.id !== actorId || !commit.sessionRevision) return false;
    const [sessionId] = JSON.parse(commit.sessionRevision) as [string];
    return realtimeAuthGeneration === `tenant:${sessionId}:${actorId}`;
  }, [actorId, readReadyProfileCommit, realtimeAuthGeneration]);

  const createFlow = useQuotationSave({ ...options, headers: stableHeaders, isEnabled: !isEditMode && editingEnabled,
    replacementSource, replacementActorId: actorId, replacementHandoffId: replacement?.handoffId,
    replacementContext: replacementSource && editingEnabled ? replacementContext : undefined,
    isReplacementAuthCurrent: replacementRequested ? isReplacementAuthCurrent : undefined });
  const editFlow = useQuotationEditSave({ existingQuotation: options.existingQuotation ?? null,
    isEnabled: isEditMode && editingEnabled, canUpdate: options.canUpdate, canSend: options.canSend,
    write: options.write, onSaved: options.onSaved });

  const activeQuotation = isEditMode ? (editFlow.confirmedQuotation ?? options.existingQuotation ?? null) : null;
  const editingIssued = activeQuotation?.lifecycleStatus === "SENT" && options.canSend;
  const editStatusAllowed = activeQuotation?.lifecycleStatus === "DRAFT" || editingIssued;
  const write = isEditMode ? editFlow.write : createFlow.write;
  const headers = useMemo(() => isEditMode && activeQuotation
    ? (editFlow.lockedHeaders ?? quotationScopedHeaders(activeQuotation))
    : (createFlow.lockedHeaders ?? stableHeaders), [activeQuotation, createFlow.lockedHeaders, editFlow.lockedHeaders, isEditMode, stableHeaders]);
  const savedQuotation = isEditMode || replacementUnavailable ? null : createFlow.savedQuotation;
  const mode = savedQuotation ? "saved" as const : "editing" as const;
  const replacementNeedsLines = Boolean(replacementSource) && createFlow.partialHeader === null;

  const currencies = useQuotationCurrencies(headers, !isEditMode && editingEnabled && handoffReady
    && options.canCreate && mode === "editing" && createFlow.partialHeader === null && hasQuotationScope(headers));
  const currencyKnown = isEditMode || createFlow.partialHeader !== null || (!currencies.loading && !currencies.error
    && currencies.canRead && currencies.currencies.some((c) => c.code === fields.currencyCode.trim().toUpperCase()));
  const currencyUnavailable = !isEditMode && createFlow.partialHeader === null && fields.currencyCode !== ""
    && !currencies.loading && !currencies.error && currencies.canRead && !currencyKnown;
  useEffect(() => {
    if (isEditMode || currencyTouched || fields.currencyCode || !currencies.defaultCode || createFlow.partialHeader || createFlow.savedQuotation) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setFields((cur) => cur.currencyCode ? cur : { ...cur, currencyCode: currencies.defaultCode });
      setBaseline((cur) => cur.currencyCode ? cur : { ...cur, currencyCode: currencies.defaultCode });
    });
    return () => { cancelled = true; };
  }, [createFlow.partialHeader, createFlow.savedQuotation, currencies.defaultCode, currencyTouched, fields.currencyCode, isEditMode]);

  const customerSearch = useQuotationCustomers(headers,
    !isEditMode && editingEnabled && handoffReady && options.canCreate && mode === "editing" && createFlow.partialHeader === null);
  const customers = replacementSource ? { ...customerSearch, options: customerSearch.options.filter((o) =>
    o.partyId === replacementSource.partyId && o.crmCustomerProfileId === replacementSource.crmCustomerProfileId
    && o.eligibilitySource === "CRM_PROFILE") } : customerSearch;
  const candidate = customers.options.length === 1 ? customers.options[0] : null;
  const replacementCustomerReady = !replacementNeedsLines || (!customers.error && !customers.isLoading
    && candidate?.quotationSelectable === true && (candidate.commercialAccountStatus === "NONE" || candidate.commercialAccountStatus === "ACTIVE"));

  const contacts = useQuotationContacts({
    headers,
    partyId: isEditMode ? (activeQuotation?.partyId ?? null) : (fields.selected?.partyId ?? null),
    partyType: isEditMode ? null : (fields.selected?.partyType ?? null),
    enabled: editingEnabled && mode === "editing" && (isEditMode
      ? options.canUpdate && editStatusAllowed
      : (options.canCreate || options.canUpdate) && createFlow.partialHeader === null),
  });

  const activeCurrency = (activeQuotation?.currencyCode ?? fields.currencyCode).trim().toUpperCase();
  const activePartyId = activeQuotation?.partyId ?? createFlow.partialHeader?.partyId ?? fields.selected?.partyId ?? null;
  const lineDraft = useTradeLineDraft(headers, activeCurrency, activePartyId, "SALES",
    editingEnabled && (isEditMode ? options.canUpdate : (options.canCreate || createFlow.partialHeader !== null) && options.canUpdate) && mode === "editing",
    !isEditMode, false);

  const applyHydratedFields = useCallback((hydrated: HydratedQuotationWorkspaceData, quotation: QuotationDetail) => {
    const next = buildEditDraftFields(quotation, hydrated);
    setBaseline(next);
    setFields(next);
    setExtraTerms(hydrated.terms.extraTerms);
    setChosenEditContact(null);
    setFormError(null);
  }, []);

  const catalogHydration = useQuotationCatalogHydration({
    quotation: activeQuotation, headers,
    enabled: isEditMode && editingEnabled && options.canUpdate,
    canReadItems: options.canReadItems ?? true, language: lang,
    fallbackValidUntil: defaultValidUntil, lineDraft, onHydrateFields: applyHydratedFields,
  });

  const updateDiscount = useCallback((change: (current: QuotationDiscountDraft) => QuotationDiscountDraft) => {
    if (write.isBlocked || savedQuotation) return;
    setFields((cur) => { const discount = change(cur.discount); return discount === cur.discount ? cur : { ...cur, discount }; });
  }, [savedQuotation, write.isBlocked]);

  const pricing = useQuotationPricing({
    draft: fields.discount, update: updateDiscount, headers,
    currencyCode: activeCurrency, partyId: activePartyId,
    crmCustomerProfileId: activeQuotation ? activeQuotation.crmCustomerProfileId
      : (createFlow.partialHeader?.crmCustomerProfileId ?? fields.selected?.crmCustomerProfileId ?? replacementSource?.crmCustomerProfileId ?? null),
    contextKey: JSON.stringify([actorId, quotationScope(headers), activePartyId ?? replacementSource?.partyId ?? null]),
    lines: lineDraft.lines,
    priceBooksByLineId: isEditMode ? catalogHydration.activePriceBooksByLineId : undefined,
    blockedLines: isEditMode ? catalogHydration.hasUnavailableLines : false,
    enabled: editingEnabled && mode === "editing" && hasQuotationScope(headers)
      && (isEditMode ? (options.canUpdate && catalogHydration.hydrationReady) : (replacementCustomerReady && handoffReady)),
    locked: write.isBlocked || mode !== "editing",
    stale: write.writeError?.code === "TRADE.QUOTE.PRICING_CHANGED",
    writeError: write.writeError, clearWriteError: write.clearWriteError,
  });

  const delivery = parseQuotationTerm(fields.deliveryDays, 14);
  const warranty = parseQuotationTerm(fields.warrantyMonths, 12);
  const originalContact = activeQuotation?.contactPartyId ?? "";
  const referenceChanged = Boolean(activeQuotation && editStatusAllowed
    && fields.draftReference.trim() !== (activeQuotation.draftReference ?? "").trim());
  const contactChanged = Boolean(activeQuotation && editStatusAllowed
    && fields.contactPartyId !== originalContact);
  const editSelectedContact = chosenEditContact?.partyId === fields.contactPartyId ? chosenEditContact
    : contacts.options.find((o) => o.partyId === fields.contactPartyId) ?? null;
  const contactValid = isEditMode
    ? (!contactChanged || fields.contactPartyId === "" || (contacts.partyType === "ORGANIZATION" && editSelectedContact !== null))
    : quotationContactMatchesCustomer(fields.selected, fields.contactPartyId, fields.selectedContact);

  const hasPopulatedLines = lineDraft.lines.some((line) => line.itemId !== "");
  const linesValid = lineDraft.lines.length <= 1_000 && lineDraft.lines.every((line) =>
    Object.keys(validateTradeLine(line)).length === 0) && lineDraft.invalidLineIndex === null && !catalogHydration.hasUnavailableLines;
  const headerValid = hasQuotationScope(headers) && fields.draftReference.trim().length <= TRADE_DRAFT_REFERENCE_MAX_LENGTH && contactValid
    && (isEditMode || ((createFlow.partialHeader !== null || Boolean(fields.selected?.quotationSelectable))
      && (!replacementNeedsLines || (replacementCustomerReady && fields.selected?.partyId === replacementSource?.partyId
        && fields.selected?.crmCustomerProfileId === replacementSource?.crmCustomerProfileId))
      && /^[A-Z]{3}$/u.test(activeCurrency) && currencyKnown));

  const headerDirty = isEditMode && (referenceChanged || contactChanged);
  const commercialDirty = useMemo(() => {
    if (!isEditMode || !activeQuotation || !catalogHydration.hydrated || !catalogHydration.hydrationReady) return false;
    if (!activeQuotation.currentRevisionId) return hasPopulatedLines;
    const base = catalogHydration.hydrated;
    const baseDelivery = parseQuotationTerm(base.terms.deliveryDays, 14);
    const baseWarranty = parseQuotationTerm(base.terms.warrantyMonths, 12);
    if (fields.validUntil.trim() !== base.validUntil.trim()
      || (fields.paymentTermCode.trim() || "NET_30") !== (base.terms.paymentTermCode.trim() || "NET_30")
      || (fields.incotermCode.trim() || "EXW") !== (base.terms.incotermCode.trim() || "EXW")
      || delivery === null || warranty === null || delivery !== baseDelivery || warranty !== baseWarranty
      || JSON.stringify(fields.discount) !== JSON.stringify(base.discount)
      || lineDraft.lines.length !== base.lines.length) return true;
    return lineDraft.lines.some((line, idx) => {
      const orig = base.lines[idx];
      if (!orig || line.clientLineId !== orig.clientLineId || line.uomId !== orig.uomId) return true;
      const expectedItem = orig.itemId || catalogHydration.resolvedLegacyItemByLine[orig.clientLineId] || "";
      if (line.itemId !== expectedItem) return true;
      return (canonicalizeDecimalInput(line.quantity) ?? line.quantity.trim()) !== (canonicalizeDecimalInput(orig.quantity) ?? orig.quantity.trim());
    });
  }, [activeQuotation, catalogHydration.hydrated, catalogHydration.hydrationReady, catalogHydration.resolvedLegacyItemByLine,
    delivery, fields.discount, fields.incotermCode, fields.paymentTermCode, fields.validUntil, hasPopulatedLines, isEditMode, lineDraft.lines, warranty]);

  const commercialReady = options.canUpdate && hasPopulatedLines && linesValid
    && validQuotationDate(fields.validUntil) && delivery !== null && warranty !== null && pricing.ready;
  const editNeedsRevision = commercialDirty || (editingIssued && headerDirty);

  const canSubmitHeaderOnly = !isEditMode && mode === "editing" && editingEnabled && createFlow.replacementReconciliation?.kind !== "confirmed"
    && (options.canCreate || createFlow.partialHeader !== null) && headerValid && !write.isBlocked;
  const canSubmit = isEditMode
    ? Boolean(editingEnabled && options.canUpdate && editStatusAllowed && editFlow.isDetailsCurrent && !write.isBlocked
      && headerValid && (headerDirty || editNeedsRevision) && (!editNeedsRevision || commercialReady))
    : (canSubmitHeaderOnly && (!(hasPopulatedLines || Boolean(replacementSource)) || commercialReady));
  const isDirty = isEditMode
    ? (catalogHydration.hydrationReady && (headerDirty || commercialDirty))
    : (mode === "editing" && (JSON.stringify(fields) !== JSON.stringify(baseline)
      || lineDraft.lines.some((l) => l.itemId !== "" || l.uomId !== "" || l.quantity !== "1")));

  const headerFieldsLocked = isEditMode ? !editStatusAllowed : (createFlow.partialHeader !== null || savedQuotation !== null);
  const identityLocked = isEditMode || createFlow.partialHeader !== null || savedQuotation !== null;
  const headerLocked = identityLocked || Boolean(replacementSource);

  const setField = useCallback(<K extends keyof QuotationDraftFields>(key: K, value: QuotationDraftFields[K]) => {
    if (write.isBlocked || savedQuotation) return;
    if (identityLocked && (key === "selected" || key === "currencyCode")) return;
    if (headerFieldsLocked && (key === "draftReference" || key === "contactPartyId" || key === "selectedContact")) return;
    setFormError(null);
    setFields((cur) => ({ ...cur, [key]: value }));
  }, [headerFieldsLocked, identityLocked, savedQuotation, write.isBlocked]);

  const selectCustomer = useCallback((id: string | undefined) => {
    if (write.isBlocked || savedQuotation || identityLocked) return;
    const selected = customers.options.find((item) => item.partyId === id && item.quotationSelectable) ?? null;
    setFormError(null);
    setFields((cur) => cur.selected?.partyId === selected?.partyId && cur.selected?.partyType === selected?.partyType
      ? { ...cur, selected } : { ...cur, selected, contactPartyId: "", selectedContact: null });
  }, [customers.options, identityLocked, savedQuotation, write.isBlocked]);

  const selectContact = useCallback((id: string | undefined) => {
    if (write.isBlocked || savedQuotation || headerFieldsLocked) return;
    const selected = id ? contacts.options.find((item) => item.partyId === id) : null;
    if (isEditMode) {
      if (id && id !== originalContact && (contacts.partyType !== "ORGANIZATION" || !selected)) return;
      setFormError(null); write.clearWriteError();
      setChosenEditContact(selected ?? null);
      setFields((cur) => ({ ...cur, contactPartyId: id ?? "", selectedContact: selected && activeQuotation
        ? { ...selected, customerPartyId: activeQuotation.partyId } : null }));
      return;
    }
    if (id && (!selected || fields.selected?.partyType !== "ORGANIZATION")) return;
    const customerPartyId = fields.selected?.partyId;
    setFormError(null); write.clearWriteError();
    setFields((cur) => cur.selected?.partyId !== customerPartyId ? cur : { ...cur,
      contactPartyId: selected?.partyId ?? "", selectedContact: selected && customerPartyId ? { ...selected, customerPartyId } : null });
  }, [activeQuotation, contacts.options, contacts.partyType, fields.selected, headerFieldsLocked, isEditMode, originalContact, savedQuotation, write]);

  const resetComposer = useCallback(() => {
    if (write.isBlocked) return;
    if (isEditMode && activeQuotation) {
      catalogHydration.forceRehydrate(activeQuotation);
      write.clearWriteError();
      return;
    }
    const defaults = defaultQuotationFields();
    setFields(defaults); setBaseline(defaults); setFormError(null); setCurrencyTouched(false);
    setReplacement(undefined); setRetainedCreate(undefined);
    lineDraft.reset([]); createFlow.reset();
  }, [activeQuotation, catalogHydration, createFlow, isEditMode, lineDraft, write]);

  const submit = useCallback(async (input?: { headerOnly?: boolean; confirmIssuedChange?: boolean }): Promise<boolean> => {
    if (mode !== "editing" || write.isBlocked || !editingEnabled) return false;
    setFormError(null);
    if (!headerValid) {
      setFormError(!hasQuotationScope(headers) ? t.quotationFlow.contextRequired
        : !contactValid ? t.quotationExperience.contactInvalid
          : !currencyKnown ? t.tradeDocuments.currencyHint : t.tradeDocuments.quotations.customerEmpty);
      return false;
    }
    if (isEditMode) {
      if (!activeQuotation || !options.canUpdate || !editStatusAllowed || !editFlow.isDetailsCurrent
        || (editingIssued && (!input?.confirmIssuedChange || input.headerOnly))) return false;
      const runRevision = !input?.headerOnly && editNeedsRevision;
      if (!headerDirty && !runRevision) return false;
      if (runRevision && !commercialReady) {
        setFormError(!validQuotationDate(fields.validUntil) ? t.quotationFlow.invalidDate
          : !pricing.ready ? t.quotationDiscount.previewRequired : t.quotationFlow.invalidLines);
        return false;
      }
      const patch = headerDirty ? buildUpdateQuotationHeader({
        ...(referenceChanged ? { draftReference: fields.draftReference } : {}),
        ...(contactChanged ? { contactPartyId: fields.contactPartyId } : {}),
      }) : null;
      return editFlow.saveExisting(patch, runRevision ? {
        validUntil: fields.validUntil,
        lines: pricing.request!.lines,
        pricing: pricing.request!.pricing,
        expectedPricingFingerprint: pricing.preview.calculation!.fingerprint,
        terms: buildSanitizedQuotationTerms({ paymentTermCode: fields.paymentTermCode, incotermCode: fields.incotermCode,
          deliveryDays: delivery!, warrantyMonths: warranty!, extraTerms }),
      } : null, (patched) => {
        setBaseline((cur) => ({ ...cur, draftReference: patched.draftReference ?? "", contactPartyId: patched.contactPartyId ?? "" }));
      }, input?.confirmIssuedChange);
    }
    if (replacementSource && (input?.headerOnly || !hasPopulatedLines)) return false;
    const needsRevision = !input?.headerOnly && hasPopulatedLines;
    if (needsRevision && !commercialReady) {
      setFormError(!validQuotationDate(fields.validUntil) ? t.quotationFlow.invalidDate
        : !pricing.ready ? t.quotationDiscount.previewRequired : t.quotationFlow.invalidLines);
      return false;
    }
    const create = createFlow.partialHeader ? null : fields.selected ? buildCreateQuotation(
      fields.selected, fields.currencyCode, fields.draftReference, { contactPartyId: fields.contactPartyId.trim() || undefined },
    ) : null;
    return createFlow.save(create, needsRevision ? {
      validUntil: fields.validUntil, lines: pricing.request!.lines, pricing: pricing.request!.pricing,
      expectedPricingFingerprint: pricing.preview.calculation!.fingerprint,
      terms: { paymentTermCode: fields.paymentTermCode.trim() || "NET_30",
        incotermCode: fields.incotermCode.trim() || "EXW", deliveryDays: delivery!, warrantyMonths: warranty! },
    } : null);
  }, [activeQuotation, commercialReady, contactChanged, contactValid, createFlow, currencyKnown, delivery,
    editFlow, editNeedsRevision, editStatusAllowed, editingEnabled, editingIssued, extraTerms, fields, hasPopulatedLines,
    headerDirty, headerValid, headers, isEditMode, mode, options.canUpdate, pricing, referenceChanged, replacementSource, t, warranty, write.isBlocked]);

  const protection = useQuotationScopeProtection({ enabled: options.isEnabled, dirty: isDirty,
    locked: headerLocked, blocked: write.isBlocked, save: () => submit(), reset: resetComposer });

  const restoreLines = lineDraft.restore;
  const restoreHeader = createFlow.restoreHeader;
  const setCustomerSearch = customerSearch.setSearch;
  useEffect(() => {
    if (isEditMode || !options.hydrateHandoff || hydratedHandoff.current || !actorId || !options.isEnabled || !hasQuotationScope(stableHeaders)
      || (replacementRequested && !realtimeAuthGeneration)) return;
    hydratedHandoff.current = true;
    const snapshot = readQuotationHandoff(actorId, stableHeaders, options.replacementQuoteId);
    const key = options.replacementQuoteId ? readQuotationReplacementCreateKey(actorId, stableHeaders, options.replacementQuoteId) : undefined;
    if (!replacementRequested) safeSessionStorage.removeItem(QUOTATION_HANDOFF_STORAGE_KEY);
    if (!snapshot) {
      queueMicrotask(() => { if (key) setRetainedCreate({ key, context: replacementContext }); setHandoffReady(true); });
      return;
    }
    queueMicrotask(() => {
      const { partialHeader, scope, lineDraft: restored, replacementSource: source, replacementHandoffId, ...form } = snapshot;
      if (key) setRetainedCreate({ key, context: replacementContext });
      setFields({ ...form, currencyCode: partialHeader?.currencyCode ?? form.currencyCode });
      if (source && replacementHandoffId) {
        setReplacement({ source, handoffId: replacementHandoffId, context: replacementContext });
        setCustomerSearch(source.displayName);
      }
      setCurrencyTouched(true); restoreLines(restored); restoreHeader(partialHeader, partialHeader ? scope : null); setHandoffReady(true);
    });
  }, [actorId, isEditMode, options.hydrateHandoff, options.isEnabled, options.replacementQuoteId, realtimeAuthGeneration,
    replacementContext, replacementRequested, restoreHeader, restoreLines, setCustomerSearch, stableHeaders]);

  const saveHandoffSnapshot = useCallback((): boolean => {
    if (isEditMode || !actorId || replacementRequested || write.isBlocked || mode !== "editing") return false;
    const ids = new Set(lineDraft.lines.map((line) => line.itemId));
    const success = writeQuotationHandoff(actorId, { ...fields, scope: quotationScope(headers), partialHeader: createFlow.partialHeader,
      lineDraft: { lines: lineDraft.lines, items: Object.values(lineDraft.itemsById).filter((i) => ids.has(i.id)),
        uomsByItem: Object.fromEntries(Object.entries(lineDraft.uomsByItem).filter(([id]) => ids.has(id))) } });
    if (!success) setFormError(t.quotationFlow.handoffFailed);
    return success;
  }, [actorId, createFlow.partialHeader, fields, headers, isEditMode, lineDraft, mode, replacementRequested, t.quotationFlow.handoffFailed, write.isBlocked]);

  const editDisplayName = activeQuotation ? partyDisplayName(activeQuotation.partySnapshot ?? {}) : null;
  const canPrepareReplacement = Boolean(isEditMode && activeQuotation && actorId && options.canCreate && options.canUpdate && options.onReplacementReady
    && !write.isBlocked && activeQuotation.lifecycleStatus === "DRAFT" && !activeQuotation.documentNumber && !activeQuotation.currentRevisionId
    && !activeQuotation.acceptedRevisionId && activeQuotation.revisions.length === 0 && activeQuotation.currentLines.length === 0
    && activeQuotation.customerEligibilitySource === "CRM_PROFILE" && activeQuotation.crmCustomerProfileId && editDisplayName
    && !activeQuotation.contactPartyId && hasPopulatedLines && write.writeError?.status === 409 && write.writeError.code === "TRADE.PRICE.MARGIN_GUARD");

  const prepareReplacement = useCallback(() => {
    if (!canPrepareReplacement || !activeQuotation?.crmCustomerProfileId || !editDisplayName || !actorId) return;
    const ids = new Set(lineDraft.lines.map((line) => line.itemId));
    const stored = writeQuotationHandoff(actorId, { ...defaultQuotationFields(), ...fields, selected: null, selectedContact: null, contactPartyId: "",
      scope: quotationScope(headers), partialHeader: null,
      replacementSource: { quotationId: activeQuotation.id, version: activeQuotation.version, partyId: activeQuotation.partyId,
        crmCustomerProfileId: activeQuotation.crmCustomerProfileId, displayName: editDisplayName },
      lineDraft: { lines: lineDraft.lines, items: Object.values(lineDraft.itemsById).filter((i) => ids.has(i.id)),
        uomsByItem: Object.fromEntries(Object.entries(lineDraft.uomsByItem).filter(([id]) => ids.has(id))) } });
    setReplacementHandoffFailed(!stored);
    if (stored) options.onReplacementReady?.(activeQuotation.id);
  }, [activeQuotation, actorId, canPrepareReplacement, editDisplayName, fields, headers, lineDraft, options]);

  const hasOrganizationCustomer = isEditMode
    ? (contacts.partyType === "ORGANIZATION" || Boolean(activeQuotation?.contactPartyId))
    : fields.selected?.partyType === "ORGANIZATION";
  const selectedForView = isEditMode && activeQuotation
    ? buildHydratedCustomerOption(activeQuotation, hasOrganizationCustomer ? "ORGANIZATION" : "PERSON")
    : fields.selected;

  const reloadSavedDetails = useCallback(async () => {
    if (!isEditMode) {
      await createFlow.reloadSavedDetails();
      return;
    }
    const hadRefChange = referenceChanged;
    const hadContactChange = contactChanged;
    const prevRevId = activeQuotation?.currentRevisionId ?? null;
    const detail = await editFlow.reloadExistingDetails();
    if (!detail) return;
    if (detail.currentRevisionId !== prevRevId) {
      catalogHydration.forceRehydrate(detail);
      return;
    }
    setFields((cur) => ({
      ...cur,
      ...(!hadRefChange ? { draftReference: detail.draftReference ?? "" } : {}),
      ...(!hadContactChange ? { contactPartyId: detail.contactPartyId ?? "" } : {}),
    }));
    setBaseline((cur) => ({
      ...cur,
      draftReference: detail.draftReference ?? "",
      contactPartyId: detail.contactPartyId ?? "",
    }));
  }, [activeQuotation?.currentRevisionId, catalogHydration, contactChanged, createFlow, editFlow, isEditMode, referenceChanged]);

  return {
    ...fields, selected: selectedForView,
    ...(isEditMode ? {
      partialHeader: null, savedQuotation: null, lockedHeaders: headers, detailsError: editFlow.detailsError,
      isDetailsCurrent: editFlow.isDetailsCurrent, replacementStorageError: false, replacementReconciliation: null,
      replacementRetryBlocked: false, partialHeaderConflict: editFlow.versionConflict, isReloadingDetails: editFlow.isReloadingDetails,
      savingStep: editFlow.savingStep, write, save: createFlow.save, canSendSaved: editFlow.canSendSaved,
      sendSaved: editFlow.sendExisting, reloadSavedDetails,
      restoreHeader: createFlow.restoreHeader, reset: resetComposer,
    } : createFlow),
    isEditMode, existingQuotation: activeQuotation, headerLocked: identityLocked, scopeLocked: headerLocked, headerFieldsLocked, hasOrganizationCustomer,
    headerDirty, commercialDirty,
    lineDisplayById: isEditMode ? catalogHydration.lineDisplayById : undefined,
    hasUnavailableLines: isEditMode && catalogHydration.hasUnavailableLines,
    canPrepareReplacement, prepareReplacement, replacementHandoffFailed,
    mode, customers, contacts, currencies, currencyUnavailable, lineDraft, pricing, hasPopulatedLines, isDirty, canSubmit,
    savedQuotation, canSendSaved: isEditMode ? editFlow.canSendSaved : (!replacementUnavailable && createFlow.canSendSaved),
    canSubmitHeaderOnly: canSubmitHeaderOnly && !replacementSource, formError, resetComposer, submit, saveHandoffSnapshot,
    replacementSource, replacementUnavailable, replacementCreateKey,
    scopeChangePending: protection.pending, isChangingScope: protection.isChanging,
    confirmScopeChange: protection.confirm, cancelScopeChange: protection.cancel,
    contactPartyError: !contactValid || write.writeError?.fieldErrors?.contactPartyId ? t.quotationExperience.contactInvalid : undefined,
    validUntilError: hasPopulatedLines && !validQuotationDate(fields.validUntil) ? t.quotationFlow.invalidDate : undefined,
    deliveryDaysError: delivery === null ? t.tradeDocuments.executive.revisionTermIntegerInvalid : undefined,
    warrantyMonthsError: warranty === null ? t.tradeDocuments.executive.revisionTermIntegerInvalid : undefined,
    selectCustomer, selectContact,
    setCurrencyCode: (value: string) => { setCurrencyTouched(true); setField("currencyCode", value.toUpperCase()); },
    setDraftReference: (value: string) => setField("draftReference", value),
    setContactPartyId: (value: string) => selectContact(value || undefined),
    setValidUntil: (value: string) => setField("validUntil", value),
    setPaymentTermCode: (value: string) => setField("paymentTermCode", value),
    setIncotermCode: (value: string) => setField("incotermCode", value),
    setDeliveryDays: (value: string) => setField("deliveryDays", value),
    setWarrantyMonths: (value: string) => setField("warrantyMonths", value),
  };
}

export type QuotationComposerState = ReturnType<typeof useQuotationComposer>;
