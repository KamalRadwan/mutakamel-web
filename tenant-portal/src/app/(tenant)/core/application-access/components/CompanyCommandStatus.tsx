"use client";

import { Button, DetailSection, IdentifierText, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { CompanyCommandOutcome } from "../company-command-status";

interface Props {
  status: CompanyCommandOutcome | null;
  canRead: boolean;
  ready: boolean;
  loading: boolean;
  error: NormalizedApiError | null;
  reload: () => void;
}
export function CompanyCommandStatus({ status, canRead, ready, loading, error, reload }: Props) {
  const { t } = useI18n(), copy = t.applicationCommandStatus;
  if (!status) return null;
  return <PermissionGate require={[]} denied={!canRead || error?.status === 403}>
    <section aria-label={copy.title} className="min-w-0 space-y-3 rounded-md border border-border p-4" aria-busy={loading || undefined}>
      <DetailSection title={copy.title} description={copy.historical} fields={[
        { label: copy.state, value: status.state === "PENDING" ? copy.pending : copy.rejected },
        { label: t.addonAssignmentCommand.originalKey, value: <IdentifierText>{status.commandId}</IdentifierText> },
        { label: t.applicationAccess.revision, value: <IdentifierText>{status.revision}</IdentifierText> },
        ...(status.state === "PENDING" ? [
          { label: copy.pages, value: <IdentifierText>{status.progress.pageNumber}</IdentifierText> },
          { label: copy.branches, value: <IdentifierText>{status.progress.validatedBranchCount}</IdentifierText> },
        ] : [{ label: copy.reason, value: copy.reasons[status.reason] }]),
      ]} />
      <p role="status" className="text-sm text-muted-foreground">{status.state === "PENDING" ? copy.pendingNotice : copy.rejectedNotice}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error.status === 404 ? copy.notFound : copy.failed}</p>}
      {status.state === "PENDING" && <Button variant="outline" loading={loading} disabled={!ready || loading} onClick={reload}>{copy.read}</Button>}
    </section>
  </PermissionGate>;
}
