import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
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
  const { lang, dir } = useI18n();
  const copy = ADD_APPLICATION_COPY[lang];
  const [applications, setApplications] = useState<ApplicationView[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
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

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return setError(copy.selectEligible);
    if (reason.trim().length < 8) {
      return setError(copy.reasonMinimum);
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
          : copy.initializeFailed,
      );
    }
  };

  const emptyMessage = eligible.length
    ? copy.allBound
    : copy.noneEligible;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <DialogContent dir={dir} showCloseButton={!isSubmitting} className="p-0">
        <DialogHeader className="mb-0 border-b border-border px-5 py-4 pe-12">
          <DialogTitle
            className="flex items-center gap-2 text-base"
          >
            <Plus className="size-4 text-info" aria-hidden="true" />
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {copy.description}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 p-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {copy.loading}
            </div>
          ) : !available.length ? (
            <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            <>
              <Field label={copy.application} required>
                {({ required, ...fieldProps }) => (
                  <Select value={selectedKey} onValueChange={setSelectedKey} dir={dir}>
                    <SelectTrigger {...fieldProps} aria-required={required}>
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
                )}
              </Field>
              {selected && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted p-3 text-sm">
                  <div>
                    <span className="block text-xs font-medium uppercase text-muted-foreground">
                      {copy.catalogueRevision}
                    </span>
                    <code>{selected.catalogueRevision}</code>
                  </div>
                  <div>
                    <span className="block text-xs font-medium uppercase text-muted-foreground">
                      {copy.policyRevision}
                    </span>
                    <code>{selected.databasePolicy.policyRevision}</code>
                  </div>
                </div>
              )}
              <Field label={copy.reason} hint={copy.reasonHint.replace("{{count}}", String(reason.trim().length))} required>
                {(fieldProps) => (
                  <Textarea
                    {...fieldProps}
                    minLength={8}
                    maxLength={500}
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="resize-none"
                  />
                )}
              </Field>
            </>
          )}
          {error && (
            <p
              ref={errorRef}
              role="alert"
              tabIndex={-1}
              className="rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-sm text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              {copy.cancel}
            </Button>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={isSubmitting}
              disabled={isSubmitting || isLoading || !available.length}
            >
              {copy.initialize}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ADD_APPLICATION_COPY = {
  en: {
    title: "Add Application access",
    description: "Core creates the fixed principal and password. No secret is returned to this portal.",
    loading: "Loading eligible Applications…",
    application: "Application",
    catalogueRevision: "Catalogue revision",
    policyRevision: "Policy revision",
    reason: "Operational reason",
    reasonHint: "{{count}}/500 · minimum 8 characters",
    cancel: "Cancel",
    initialize: "Initialize access",
    selectEligible: "Select an eligible Application.",
    reasonMinimum: "Enter a reason of at least 8 characters.",
    initializeFailed: "Application access could not be initialized.",
    allBound: "Every eligible Application already has a binding on this database server.",
    noneEligible: "No Application is eligible. It must be PUBLISHED with tenant-database access and an active permission manifest, and be either ACTIVE or a REQUIRED draft.",
  },
  ar: {
    title: "إضافة وصول تطبيق",
    description: "ينشئ Core الحساب الثابت وكلمة المرور. لا تُعاد أي أسرار إلى هذه اللوحة.",
    loading: "جارٍ تحميل التطبيقات المؤهلة…",
    application: "التطبيق",
    catalogueRevision: "مراجعة الكتالوج",
    policyRevision: "مراجعة السياسة",
    reason: "سبب العملية",
    reasonHint: "{{count}}/500 · 8 أحرف على الأقل",
    cancel: "إلغاء",
    initialize: "تهيئة الوصول",
    selectEligible: "اختر تطبيقًا مؤهلًا.",
    reasonMinimum: "أدخل سببًا لا يقل عن 8 أحرف.",
    initializeFailed: "تعذرت تهيئة وصول التطبيق.",
    allBound: "كل التطبيقات المؤهلة مرتبطة بالفعل بخادم قاعدة البيانات هذا.",
    noneEligible: "لا يوجد تطبيق مؤهل. يجب أن يكون منشورًا مع وصول قاعدة بيانات المستأجر وبيان صلاحيات نشط، وأن يكون نشطًا أو مسودة مطلوبة.",
  },
} as const;
