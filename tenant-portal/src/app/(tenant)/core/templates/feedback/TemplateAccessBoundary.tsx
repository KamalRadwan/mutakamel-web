"use client";

import type { ReactNode } from "react";
import { PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TEMPLATE_READ_PERMISSION } from "../templates-contract";
import { useTemplateFeedbackFocus } from "./useTemplateFeedbackFocus";

/** The caller supplies an authoritative denial; this does not grant access. */
export function TemplateAccessBoundary({ revoked, children }: { revoked: boolean; children: ReactNode }) {
  const { t } = useI18n();
  const target = useTemplateFeedbackFocus(revoked);
  if (!revoked) return <>{children}</>;
  return <div ref={target} tabIndex={-1} role="region" aria-label={t.permissionGate.title}
    className="min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <PermissionGate require={TEMPLATE_READ_PERMISSION} denied>{null}</PermissionGate>
  </div>;
}
