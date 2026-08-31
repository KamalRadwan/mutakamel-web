"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/lib/api/errors";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { createTemplate, fetchCreationScopes, fetchTemplateStarters } from "../templates-api";
import type { TemplateCreationScope, TemplateStarter } from "../template-discovery-contract";
import {
  TEMPLATE_CODE_MAX,
  TEMPLATE_NAME_MAX,
  type TemplateAdapterKey,
  type TemplateDirection,
  type TemplateDocumentType,
  type TemplateLayoutMode,
  type TemplateLocale,
  type TemplateOutputChannel,
} from "../templates-contract";

export interface TemplateCreateValues {
  scopeIndex: string;
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
}

const EMPTY_TEMPLATE_CREATE: TemplateCreateValues = {
  scopeIndex: "0",
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
};

/**
 * Create from a starter.
 *
 * `GET /templates/starters` is filtered by the **exact** doc / output / layout /
 * adapter / schema / locale / direction / scope tuple, so the starter list is
 * refetched whenever any one of those moves — a starter that no longer matches
 * is not a starter this definition can use.
 */
export function useTemplateCreate(isOpen: boolean) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const copy = t.coreOperations.templates;

  const [values, setValues] = useState<TemplateCreateValues>(EMPTY_TEMPLATE_CREATE);
  const [scopes, setScopes] = useState<TemplateCreationScope[]>([]);
  const [starters, setStarters] = useState<TemplateStarter[]>([]);
  const [isLoadingStarters, setIsLoadingStarters] = useState(false);
  const [scopesUnavailable, setScopesUnavailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void (async () => {
        try {
          setScopes(await fetchCreationScopes(controller.signal));
          setScopesUnavailable(false);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setScopesUnavailable(true);
        }
      })();
    });
    return () => controller.abort();
  }, [isOpen]);

  const scope = scopes[Number(values.scopeIndex)] ?? null;

  useEffect(() => {
    if (!isOpen || !scope) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void (async () => {
        setIsLoadingStarters(true);
        try {
          setStarters(
            await fetchTemplateStarters(
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
            ),
          );
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          // No compatible starter is an ordinary answer, not a failure.
          setStarters([]);
        } finally {
          if (!controller.signal.aborted) setIsLoadingStarters(false);
        }
      })();
    });
    return () => controller.abort();
  }, [
    isOpen,
    scope,
    values.documentType,
    values.outputChannel,
    values.layoutMode,
    values.dataSourceKey,
    values.locale,
    values.direction,
  ]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!scope || isSubmitting) return false;
    const code = values.code.trim().toUpperCase();
    const name = values.name.trim();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,99}$/u.test(code)) {
      setFormError(copy.codeInvalid);
      return false;
    }
    if (name.length === 0 || name.length > TEMPLATE_NAME_MAX) {
      setFormError(copy.nameRequired);
      return false;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      const created = await createTemplate({
        code: code.slice(0, TEMPLATE_CODE_MAX),
        name,
        ...(values.description.trim() ? { description: values.description.trim() } : {}),
        documentType: values.documentType,
        outputChannel: values.outputChannel,
        layoutMode: values.layoutMode,
        dataSourceKey: values.dataSourceKey,
        locale: values.locale,
        direction: values.direction,
        scope:
          scope.type === "TENANT"
            ? { type: "TENANT" }
            : { type: "COMPANY", companyId: scope.companyId },
        ...(values.starterKey ? { starterKey: values.starterKey } : {}),
      });
      toast.success(copy.savedTitle, copy.created);
      router.push(`${TENANT_ROUTES.coreTemplates}/${created.id}`);
      return true;
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        toast.errorFromApi(copy.createFailed, normalized);
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [scope, isSubmitting, values, toast, copy, router]);

  return {
    values,
    scopes,
    scope,
    scopesUnavailable,
    starters,
    isLoadingStarters,
    isSubmitting,
    formError,
    change: (patch: Partial<TemplateCreateValues>) =>
      setValues((current) => ({ ...current, ...patch })),
    reset: () => {
      setValues(EMPTY_TEMPLATE_CREATE);
      setFormError(null);
    },
    submit,
  };
}
