"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { buildWidgetDraft } from "../widget-draft-form";
import type { WidgetFormState } from "../widget-form";
import { useWidgets } from "./useWidgets";

export function useWidgetCreatePage() {
  const list = useWidgets();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const [failure, setFailure] = useState<{ scope: string; message: string } | null>(null);
  const cancel = () => router.push(TENANT_ROUTES.crmWidgets);
  const create = async (form: WidgetFormState) => {
    setFailure(null);
    const result = await list.create(buildWidgetDraft(form, list.catalog));
    if (result.stale) return;
    if (result.ok && result.createdId) {
      toast.success(t.crmWidgets.lifecycle.savedDraft);
      if (result.reconciled === false) toast.info(t.crmWidgets.review.savedRefreshFailed);
      router.replace(`${TENANT_ROUTES.crmWidgets}/${result.createdId}`);
      return;
    }
    if (!result.error && !result.uncertain) return;
    const message = result.uncertain ? t.crmWidgets.review.uncertain : result.error?.status === 403
      ? t.crmWidgets.review.writeDenied : t.crmDashboards.errors[result.error?.code ?? ""] ?? t.crmDashboards.actionFailed;
    setFailure({ scope: list.scope, message });
    if (result.error) toast.outcomeFromApi(result.error);
  };

  return { list, error: failure?.scope === list.scope ? failure.message : undefined, cancel, create };
}
