"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";
import {
  Badge,
  Button,
  DegradedBanner,
  DetailHeader,
  DetailSection,
  ErrorState,
  NotFoundState,
  PermissionGate,
  Skeleton,
  useToast,
} from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeGet, tradeIfMatch, tradePatch } from "../../trade-api";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { hasTradePermission, useTradeScope } from "../../trade-advanced-scope";
import {
  IMPORT_MANAGE_PERMISSION,
  importFormMessage,
  importMessage,
} from "../../imports/import-contract";
import {
  buildUpdateImportMappingRequest,
  importMappingPath,
  parseImportMappingDetail,
  toMappingFieldDrafts,
  type ImportMappingDetail,
  type ImportMappingFieldDraft,
} from "../import-mapping-contract";
import { MappingFieldRows } from "../components/MappingFieldRows";

const DETAIL_RESPONSE_LIMIT_BYTES = 600_000;

export default function ImportMappingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchId } = useTenantBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);

  const [mapping, setMapping] = useState<ImportMappingDetail | null>(null);
  const [fields, setFields] = useState<ImportMappingFieldDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canManage = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    IMPORT_MANAGE_PERMISSION,
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await tradeGet(importMappingPath(id), {
          signal,
          headers: scope.headers,
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        });
        const parsed = parseImportMappingDetail(response.data);
        setMapping(parsed);
        // The newest version's fields are what a PATCH replaces.
        setFields(toMappingFieldDrafts(parsed.versions[0]?.fields ?? []));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [id, scope.headers],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const save = async (): Promise<void> => {
    if (!canManage || !mapping || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await tradePatch(importMappingPath(mapping.id), buildUpdateImportMappingRequest(fields), {
        headers: { ...scope.headers, "If-Match": tradeIfMatch(mapping.version) },
        maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
      });
      toast.success(t.tradeCommon.savedTitle, t.tradeAutomation.mappingUpdated);
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        setSaveError(importMessage(normalized, t) ?? importFormMessage(error, t));
      }
    } finally {
      setIsSaving(false);
      await load();
    }
  };

  const content = (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={mapping?.code ?? t.tradeAutomation.mappingDetailTitle}
        subtitle={mapping ? tradeStatusLabel(t.tradeStatus, mapping.targetCode, t.common.unknownCode) : undefined}
        status={
          mapping ? (
            <Badge tone={mapping.status === "ACTIVE" ? "positive" : "neutral"}>
              {tradeStatusLabel(t.tradeStatus, mapping.status, t.common.unknownCode)}
            </Badge>
          ) : undefined
        }
        backLabel={t.tradeAutomation.backToMappings}
        backHref={TENANT_ROUTES.tradeImportMappings}
        secondaryActions={
          mapping && canManage ? (
            <Button variant="outline" loading={isSaving} onClick={() => void save()}>
              <Save className="size-4" aria-hidden="true" />
              {t.tradeAutomation.saveFields}
            </Button>
          ) : undefined
        }
      />

      {queryError?.status === 404 ? (
        <NotFoundState
          title={t.tradeAutomation.mappingNotFound}
          description={t.tradeAutomation.mappingNotFoundDescription}
          backLabel={t.tradeAutomation.backToMappings}
          backHref={TENANT_ROUTES.tradeImportMappings}
        />
      ) : isLoading ? (
        <Skeleton className="h-72" />
      ) : queryError ? (
        <ErrorState
          title={t.tradeAutomation.mappingLoadFailed}
          description={queryError.message}
          onRetry={() => void load()}
          retryLabel={t.common.retry}
        />
      ) : mapping ? (
        <>
          {saveError ? <DegradedBanner message={saveError} /> : null}
          <DetailSection
            title={t.tradeCommon.overview}
            emptyValueLabel={t.tradeCommon.notSet}
            fields={[
              {
                label: t.tradeGovernance.scopeTarget,
                value: tradeStatusLabel(t.tradeStatus, mapping.scopeTarget, t.common.unknownCode),
              },
              { label: t.tradeCommon.version, value: String(mapping.version) },
              { label: t.tradeAutomation.mappingId, value: mapping.id },
              {
                label: t.tradeCommon.updatedAt,
                value: formatDateTime(mapping.updatedAt, lang),
              },
            ]}
          />
          <DetailSection
            title={t.tradeAutomation.mappingFields}
            description={t.tradeAutomation.mappingFieldsReplaceHint}
          >
            <MappingFieldRows
              fields={fields}
              onChange={setFields}
              disabled={!canManage || isSaving}
            />
          </DetailSection>
        </>
      ) : null}
    </div>
  );

  return canManage ? (
    content
  ) : (
    <PermissionGate require={IMPORT_MANAGE_PERMISSION}>{content}</PermissionGate>
  );
}
