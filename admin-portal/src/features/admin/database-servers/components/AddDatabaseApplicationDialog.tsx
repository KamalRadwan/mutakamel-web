import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { applicationsApi } from "@/features/admin/applications/api/applications.api";
import type { ApplicationView } from "@/features/admin/applications/types";
import { normalizeApiError } from "@/shared/api/normalized-api-error";

interface Props {
  isOpen: boolean;
  boundApplicationKeys: string[];
  isSubmitting: boolean;
  onClose: () => void;
  onBootstrap: (
    applicationKey: string,
    expectedCatalogueRevision: string,
    expectedPolicyRevision: string,
    reason: string,
  ) => Promise<unknown>;
}

function isBootstrapEligible(application: ApplicationView): boolean {
  const lifecycleEligible =
    application.lifecycleStatus === "ACTIVE" ||
    (application.lifecycleStatus === "DRAFT" &&
      application.requiredOnDatabaseServer);

  return (
    lifecycleEligible &&
    application.publicationStatus === "PUBLISHED" &&
    application.databaseAccessMode === "TENANT_DATABASE" &&
    application.databasePrincipal !== null &&
    application.activeManifest !== null
  );
}

export function AddDatabaseApplicationDialog({
  isOpen,
  boundApplicationKeys,
  isSubmitting,
  onClose,
  onBootstrap,
}: Props) {
  const [applications, setApplications] = useState<ApplicationView[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boundKeyFingerprint = boundApplicationKeys.join(",");
  const boundKeys = useMemo(
    () =>
      new Set(
        boundKeyFingerprint ? boundKeyFingerprint.split(",") : [],
      ),
    [boundKeyFingerprint],
  );
  const eligible = useMemo(
    () => applications.filter(isBootstrapEligible),
    [applications],
  );
  const available = useMemo(
    () =>
      eligible.filter((application) => !boundKeys.has(application.key)),
    [boundKeys, eligible],
  );
  const selected =
    available.find((application) => application.key === selectedKey) ?? null;

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setIsLoading(true);
      setError(null);
      setReason("");
      applicationsApi
        .list({
          page: 1,
          limit: 100,
          publicationStatus: "PUBLISHED",
          databaseAccessMode: "TENANT_DATABASE",
        })
        .then(({ data }) => {
          setApplications(data);
          setSelectedKey(
            data.find(
              (application) =>
                isBootstrapEligible(application) &&
                !boundKeys.has(application.key),
            )?.key ?? "",
          );
        })
        .catch((requestError) =>
          setError(normalizeApiError(requestError).message),
        )
        .finally(() => setIsLoading(false));
    });
  }, [boundKeys, isOpen]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return setError("Select an eligible Application.");
    if (reason.trim().length < 8) {
      return setError("Enter a reason of at least 8 characters.");
    }
    setError(null);
    try {
      await onBootstrap(
        selected.key,
        selected.catalogueRevision,
        selected.databasePolicy.policyRevision,
        reason.trim(),
      );
      onClose();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Application access could not be initialized.",
      );
    }
  };

  const emptyMessage = eligible.length
    ? "Every eligible Application already has a binding on this database server."
    : "No Application is eligible. It must be PUBLISHED with tenant-database access and an active permission manifest, and be either ACTIVE or a REQUIRED draft.";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <DialogContent showCloseButton={!isSubmitting} className="p-0">
        <DialogHeader className="mb-0 border-b border-border px-5 py-4 pe-12">
          <DialogTitle
            className="flex items-center gap-2 text-base"
          >
            <Plus className="size-4 text-brand-700 dark:text-brand-300" />
            Add Application access
          </DialogTitle>
          <DialogDescription className="text-sm">
            Core creates the fixed principal and password. No secret is
            returned to this portal.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 p-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading eligible Applications…
            </div>
          ) : !available.length ? (
            <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            <>
              <div>
                <label
                  id="database-application-label"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Application
                </label>
                <Select
                  value={selectedKey}
                  onValueChange={setSelectedKey}
                >
                  <SelectTrigger aria-labelledby="database-application-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((application) => (
                      <SelectItem key={application.id} value={application.key}>
                        {application.name} · {application.databasePrincipal}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selected && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted p-3 text-sm">
                  <div>
                    <span className="block text-xs font-medium uppercase text-muted-foreground">
                      Catalogue revision
                    </span>
                    <code>{selected.catalogueRevision}</code>
                  </div>
                  <div>
                    <span className="block text-xs font-medium uppercase text-muted-foreground">
                      Policy revision
                    </span>
                    <code>{selected.databasePolicy.policyRevision}</code>
                  </div>
                </div>
              )}
              <label className="block text-sm font-medium text-foreground">
                Operational reason
                <Textarea
                  required
                  minLength={8}
                  maxLength={500}
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-1.5 resize-none"
                />
              </label>
            </>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-300"
            >
              {error}
            </p>
          )}
          <DialogFooter className="mt-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={isSubmitting}
              disabled={isSubmitting || isLoading || !available.length}
            >
              Initialize access
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
