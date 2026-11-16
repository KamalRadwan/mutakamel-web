"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/design-system";
import { templateRequestFence, useTemplateAuthority } from "./useTemplateAuthority";
import { useTemplateDataSources } from "./useTemplateDataSources";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/lib/api/errors";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { can } from "@/lib/auth/permission-scope";
import { createTemplate, fetchCreationScopes, fetchTemplateStarters } from "../templates-api";
import type { TemplateCreationScope, TemplateStarter } from "../template-discovery-contract";
import type { TemplateSourceMetadata } from "../template-source-metadata";
import { selectStarterPresentation } from "../template-starter-presentation";
import { DEFAULT_TEMPLATE_PAGE, templateCreatePage, templateCreatePageCopy, templateStarterPageValues, type TemplateCreatePageValues } from "../template-create-page";
import {
  TEMPLATE_CODE_MAX,
  TEMPLATE_CREATE_PERMISSION,
  TEMPLATE_READ_PERMISSION,
  TEMPLATE_NAME_MAX,
  type TemplateAdapterKey,
  type TemplateDirection,
  type TemplateDocumentType,
  type TemplateLayoutMode,
  type TemplateLocale,
  type TemplateOutputChannel,
} from "../templates-contract";

export interface TemplateCreateValues {
  scopeKey: string;
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  layoutMode: TemplateLayoutMode;
  dataSourceKey: TemplateAdapterKey;
  locale: TemplateLocale;
  direction: TemplateDirection;
  starterKey: string;
  code: string;
  name: string;
  description: string;
  page: TemplateCreatePageValues;
}

const EMPTY_STARTERS: TemplateStarter[] = [];

const EMPTY_TEMPLATE_CREATE: TemplateCreateValues = {
  scopeKey: "",
  documentType: "QUOTATION",
  outputChannel: "PRINT",
  layoutMode: "HYBRID_DOCUMENT",
  dataSourceKey: "TRADE_QUOTATION_PRINT_V1",
  locale: "en-US",
  direction: "AUTO",
  starterKey: "",
  code: "",
  name: "",
  description: "",
  page: DEFAULT_TEMPLATE_PAGE,
};

export function templateCreationScopeKey(scope: TemplateCreationScope) {
  return JSON.stringify([scope.type, scope.companyId ?? null]);
}

function sourceIdentity(source: TemplateSourceMetadata | undefined) {
  return source ? JSON.stringify([source.adapterKey, source.schemaVersion, source.schemaChecksum]) : null;
}

function canUseCreationScope(user: ReturnType<typeof useTenantAuth>["user"], scope: TemplateCreationScope) {
  const target = { companyId: scope.companyId ?? null };
  return (scope.type === "TENANT" ? scope.companyId == null : scope.type === "COMPANY" && !!scope.companyId) &&
    can(user, TEMPLATE_READ_PERMISSION, target) && can(user, TEMPLATE_CREATE_PERMISSION, target);
}

function permittedCreationScopes(user: ReturnType<typeof useTenantAuth>["user"], scopes: TemplateCreationScope[]) {
  return scopes.filter(scope => canUseCreationScope(user, scope));
}

/**
 * Create from a starter.
 *
 * `GET /templates/starters` is filtered by the **exact** doc / output / layout /
 * adapter / schema / locale / direction / scope tuple, so the starter list is
 * refetched whenever any one of those moves — a starter that no longer matches
 * is not a starter this definition can use.
 */
export function useTemplateCreate(isOpen: boolean, discoverWhileClosed = false) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const { authState, readReadyProfileCommit } = useTenantAuth();
  const { key, readCurrent, subscribe } = useTemplateAuthority();
  const authority = authState === "AUTHENTICATED" ? key : null;
  const user = authority ? readReadyProfileCommit()?.user ?? null : null;
  const discover = isOpen || discoverWhileClosed;
  const copy = t.coreOperations.templates;

  const [form, setForm] = useState<{ authority: string; values: TemplateCreateValues; source: string | null } | null>(null);
  const [scopeRead, setScopeRead] = useState<{ authority: string; scopes: TemplateCreationScope[]; first: string } | null>(null);
  const [scopeFailure, setScopeFailure] = useState<string | null>(null);
  const [starterRead, setStarterRead] = useState<{
    key: string;
    presentationGeneration: object;
    items: TemplateStarter[];
    error: ReturnType<typeof normalizeApiError> | null;
  } | null>(null);
  const [isLoadingStarters, setIsLoadingStarters] = useState(false);
  const [operation, setOperation] = useState<{ context: string; controller: AbortController } | null>(null);
  const pending = useRef<AbortController | null>(null);
  const [formError, setFormError] = useState<{ context: string; message: string } | null>(null);

  useEffect(() => {
    if (!discover || !authority) return;
    const controller = new AbortController();
    const current = () => {
      if (controller.signal.aborted || readCurrent() !== authority) return false;
      const profile = readReadyProfileCommit()?.user;
      return can(profile, TEMPLATE_READ_PERMISSION) && can(profile, TEMPLATE_CREATE_PERMISSION);
    };
    queueMicrotask(() => {
      if (!current()) return;
      void (async () => {
        try {
          const scopes = await fetchCreationScopes(controller.signal, templateRequestFence(current));
          if (!current()) return;
          const first = permittedCreationScopes(user, scopes)[0];
          setScopeRead(previous => ({ authority, scopes, first: previous?.authority === authority && previous.first
            ? previous.first : first ? templateCreationScopeKey(first) : "" }));
          setScopeFailure(null);
        } catch (error) {
          if (!current() || (error instanceof DOMException && error.name === "AbortError")) return;
          setScopeFailure(authority);
        }
      })();
    });
    return () => controller.abort();
  }, [discover, authority, readCurrent, readReadyProfileCommit, user]);

  const catalogue = scopeRead?.authority === authority ? scopeRead : null;
  const permittedScopes = catalogue && scopeFailure !== authority ? permittedCreationScopes(user, catalogue.scopes) : [];
  const draft = form?.authority === authority ? form : null;
  const scopeKey = draft?.values.scopeKey || catalogue?.first || "";
  const scope = permittedScopes.find(item => templateCreationScopeKey(item) === scopeKey) ?? null;
  const live = useRef<{ context: string | null; open: boolean; scopeKey: string } | null>(null);
  const scopeIsCurrent = useCallback(() => !!authority && !!scope && live.current?.scopeKey === scopeKey &&
    readCurrent() === authority && canUseCreationScope(readReadyProfileCommit()?.user ?? null, scope),
  [authority, scope, scopeKey, readCurrent, readReadyProfileCommit]);

  const sourceRead = useTemplateDataSources(discover, scope ? {
    type: scope.type, companyId: scope.companyId ?? undefined,
  } : null, authority ?? "", scopeIsCurrent);
  const preferred = draft?.values.dataSourceKey ?? EMPTY_TEMPLATE_CREATE.dataSourceKey;
  const source = sourceRead.items.find(item => item.adapterKey === preferred) ?? sourceRead.items[0];
  const sourceKey = sourceIdentity(source);
  // Clear retired edits before commit so a returning scope or schema cannot restore them.
  if (form && form.authority !== authority) {
    setForm(null);
  } else if (draft?.source && (!scope || draft.source !== sourceKey)) {
    setForm({ authority: draft.authority, source: null, values: { ...EMPTY_TEMPLATE_CREATE, scopeKey } });
  }
  const storedValues = useMemo(() => draft?.source === sourceKey && scope
    ? draft.values : { ...EMPTY_TEMPLATE_CREATE, scopeKey }, [draft, scope, scopeKey, sourceKey]);
  const baseValues = useMemo<TemplateCreateValues>(() => source ? {
    ...storedValues, scopeKey, dataSourceKey: source.adapterKey, documentType: source.documentType,
    outputChannel: source.allowedOutputChannels.includes(storedValues.outputChannel) ? storedValues.outputChannel : source.allowedOutputChannels[0],
    layoutMode: source.allowedLayoutModes.includes(storedValues.layoutMode) ? storedValues.layoutMode : source.allowedLayoutModes[0],
    locale: source.supportedLocales.includes(storedValues.locale) ? storedValues.locale : source.supportedLocales[0],
  } : storedValues, [source, storedValues, scopeKey]);
  const context = authority && scope ? JSON.stringify([authority, scopeKey, sourceKey]) : null;
  const binding = useMemo(() => ({ context, open: isOpen, scopeKey }), [context, isOpen, scopeKey]);
  useLayoutEffect(() => {
    live.current = binding;
    return () => {
      live.current = null;
      pending.current?.abort();
      pending.current = null;
    };
  }, [binding]);
  const isSubmitting = !!operation && operation.context === context && !operation.controller.signal.aborted;
  const starterQueryKey = JSON.stringify([authority, scope?.type, scope?.companyId, source?.schemaChecksum,
    baseValues.documentType, baseValues.outputChannel, baseValues.layoutMode, baseValues.dataSourceKey, baseValues.locale, baseValues.direction]);
  const presentationGeneration = useMemo(() => ({ binding, starterQueryKey }), [binding, starterQueryKey]);
  const starters = starterRead?.presentationGeneration === presentationGeneration ? starterRead.items : EMPTY_STARTERS;
  const requestedDirection = baseValues.direction === "AUTO" ? (baseValues.locale === "ar-EG" ? "RTL" : "LTR") : baseValues.direction;
  const selectedStarter = starters.find(item => item.starterKey === baseValues.starterKey &&
    item.documentType === baseValues.documentType && item.outputChannel === baseValues.outputChannel &&
    item.layoutMode === baseValues.layoutMode && item.dataSourceKey === baseValues.dataSourceKey &&
    item.dataSourceSchemaVersion === source?.schemaVersion && item.dataSourceSchemaChecksum === source?.schemaChecksum &&
    item.locale === baseValues.locale && item.resolvedDirection === requestedDirection);
  const values = baseValues.page === DEFAULT_TEMPLATE_PAGE && selectedStarter?.defaultPage
    ? { ...baseValues, page: templateStarterPageValues(selectedStarter.defaultPage) } : baseValues;
  const starterPresentation = isOpen && scope?.type === "COMPANY" && scope.companyId && source &&
    !isLoadingStarters && starterRead?.presentationGeneration === presentationGeneration && !starterRead.error
    ? selectStarterPresentation(starters, values.starterKey,
      { ...values, dataSourceSchemaVersion: source.schemaVersion }, source.schemaChecksum)
    : null;

  useEffect(() => {
    if (!isOpen || !authority || !scope || !source) return;
    const controller = new AbortController();
    const current = () => !controller.signal.aborted && live.current === binding && scopeIsCurrent();
    queueMicrotask(() => {
      if (!current()) return;
      void (async () => {
        setIsLoadingStarters(true);
        try {
          const items = await fetchTemplateStarters(
              {
                documentType: values.documentType,
                outputChannel: values.outputChannel,
                layoutMode: values.layoutMode,
                dataSourceKey: values.dataSourceKey,
                dataSourceSchemaVersion: "1",
                locale: values.locale,
                direction: values.direction,
                definitionScopeType: scope.type === "BRANCH" ? "COMPANY" : scope.type,
                ...(scope.companyId ? { definitionCompanyId: scope.companyId } : {}),
              },
              controller.signal,
              templateRequestFence(current),
            );
          if (current()) setStarterRead({ key: starterQueryKey, presentationGeneration, items, error: null });
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (current()) {
            setStarterRead({ key: starterQueryKey, presentationGeneration, items: [], error: normalizeApiError(error) });
          }
        } finally {
          if (!controller.signal.aborted) setIsLoadingStarters(false);
        }
      })();
    });
    return () => controller.abort();
  }, [
    isOpen,
    authority,
    binding,
    scopeIsCurrent,
    scope,
    values.documentType,
    values.outputChannel,
    values.layoutMode,
    values.dataSourceKey,
    values.locale,
    values.direction,
    source,
    starterQueryKey,
    presentationGeneration,
  ]);

  const submit = async (): Promise<boolean> => {
    const current = () => live.current === binding && binding.open && scopeIsCurrent();
    if (!context || !scope || !source || pending.current || !current() ||
        (values.starterKey && !selectedStarter)) return false;
    const createScope = scope.type === "TENANT" ? { type: "TENANT" as const }
      : scope.type === "COMPANY" && scope.companyId ? { type: "COMPANY" as const, companyId: scope.companyId } : null;
    if (!createScope) return false;
    const page = values.outputChannel === "PRINT" ? templateCreatePage(values.page) : null;
    if (values.outputChannel === "PRINT" && !page) {
      setFormError({ context, message: templateCreatePageCopy[lang].pageInvalid });
      return false;
    }
    const code = values.code.trim().toUpperCase();
    const name = values.name.trim();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,99}$/u.test(code)) {
      setFormError({ context, message: copy.codeInvalid });
      return false;
    }
    if (name.length === 0 || name.length > TEMPLATE_NAME_MAX) {
      setFormError({ context, message: copy.nameRequired });
      return false;
    }
    const controller = new AbortController();
    pending.current = controller;
    const stop = subscribe(() => { if (!current()) controller.abort(); });
    setOperation({ context, controller });
    setFormError(null);
    try {
      const created = await createTemplate({
        code: code.slice(0, TEMPLATE_CODE_MAX),
        name,
        ...(values.description.trim() ? { description: values.description.trim() } : {}),
        documentType: values.documentType,
        layoutMode: values.layoutMode,
        dataSourceKey: values.dataSourceKey,
        locale: values.locale,
        direction: values.direction,
        scope: createScope,
        ...(values.starterKey ? { starterKey: values.starterKey } : {}),
        ...(page ? { outputChannel: "PRINT", page } : { outputChannel: "EMAIL" }),
      }, controller.signal, templateRequestFence(current));
      if (controller.signal.aborted || !current()) return false;
      toast.success(copy.savedTitle, copy.created);
      router.push(`${TENANT_ROUTES.coreTemplates}/${created.id}`);
      return true;
    } catch (error) {
      if (controller.signal.aborted || !current() || (error instanceof DOMException && error.name === "AbortError")) return false;
      const normalized = normalizeApiError(error);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        toast.errorFromApi(copy.createFailed, normalized);
      }
      return false;
    } finally {
      stop();
      if (pending.current === controller) pending.current = null;
      setOperation(existing => existing?.controller === controller ? null : existing);
    }
  };

  return {
    values,
    sourceError: sourceRead.error,
    starterError: starterRead?.key === starterQueryKey ? starterRead.error : null,
    isLoadingSources: sourceRead.isLoading,
    hasCompatibleSource: !!source,
    documentTypes: [...new Set(sourceRead.items.map(item => item.documentType))],
    adapterKeys: sourceRead.items.filter(item => item.documentType === values.documentType).map(item => item.adapterKey),
    outputChannels: source?.allowedOutputChannels ?? [],
    layoutModes: source?.allowedLayoutModes ?? [],
    locales: source?.supportedLocales ?? [],
    scopes: permittedScopes,
    scope,
    scopesUnavailable: !!authority && scopeFailure === authority,
    starters,
    starterPresentation,
    isLoadingStarters,
    isSubmitting,
    formError: formError?.context === context ? formError.message : null,
    change: (patch: Partial<TemplateCreateValues>) => {
      if (!discover || !authority || readCurrent() !== authority || live.current !== binding) return;
      if (patch.scopeKey !== undefined) {
        if (patch.scopeKey === scopeKey || !permittedScopes.some(item => templateCreationScopeKey(item) === patch.scopeKey)) return;
        live.current = null;
        pending.current?.abort();
        setForm({ authority, source: null, values: { ...EMPTY_TEMPLATE_CREATE, scopeKey: patch.scopeKey } });
        setFormError(null);
        return;
      }
      if (!scope) return;
      const chosen = patch.documentType ? sourceRead.items.find(item => item.documentType === patch.documentType)
        : patch.dataSourceKey ? sourceRead.items.find(item => item.adapterKey === patch.dataSourceKey) : source;
      if ((patch.documentType || patch.dataSourceKey) && !chosen) return;
      const chosenKey = sourceIdentity(chosen);
      if (chosenKey !== sourceKey) {
        live.current = null;
        pending.current?.abort();
      }
      const changesTuple = ["documentType", "outputChannel", "layoutMode", "dataSourceKey", "locale", "direction"]
        .some(key => Object.hasOwn(patch, key));
      setForm(previous => {
        const prior = previous?.authority === authority && previous.values.scopeKey === scopeKey &&
          previous.source === sourceKey ? previous.values : baseValues;
        return { authority, source: chosenKey, values: { ...prior, ...patch,
          ...(chosen ? { dataSourceKey: chosen.adapterKey } : {}), ...(changesTuple ? { starterKey: "" } : {}) } };
      });
    },
    reset: () => {
      live.current = null;
      pending.current?.abort();
      setForm(null);
      setFormError(null);
    },
    submit,
  };
}
