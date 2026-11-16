"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { usePricingReferenceData } from "../../../price-books/hooks/usePricingReferenceData";
import { useVersionWorkspaceController } from "../../../price-books/workspace/useVersionWorkspaceController";

export function usePriceBookVersion(id: string) {
  const router = useRouter();
  const parentBookId = useRef<string | null>(null);
  const navigateAfterDelete = useCallback(() => {
    const parentId = parentBookId.current;
    router.push(parentId ? `${TENANT_ROUTES.tradePriceBooks}/${encodeURIComponent(parentId)}` : TENANT_ROUTES.tradePriceBooks);
  }, [router]);
  const controller = useVersionWorkspaceController({ versionId: id, onVersionDeleted: navigateAfterDelete });
  useLayoutEffect(() => { parentBookId.current = controller.detail?.book.id ?? null; }, [controller.detail?.book.id]);
  const reference = usePricingReferenceData({
    enabled: Boolean(controller.draft && controller.canRead && controller.scope.isResolved),
  });

  const navigateToVersion = useCallback(
    (nextVersionId: string) => {
      router.push(`/trade/price-book-versions/${encodeURIComponent(nextVersionId)}`);
    },
    [router],
  );

  return {
    ...controller,
    reference,
    navigateToVersion,
    hasPublishPermission: controller.canPublishGrant,
    discardDraft: controller.discardChanges,
    queryError: controller.error,
    isNotFound: !controller.validId || controller.error?.status === 404,
  };
}
