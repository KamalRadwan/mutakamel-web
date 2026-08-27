import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { storageServersApi } from "../api/storage-servers.api";
import {
  isSecureStorageEndpoint,
  requiresStorageRuntimeSetup,
  shouldResetStorageServerWriteKey,
} from "../lib/storage-server-contract";
import type { CreateStorageServerDto } from "../types";

const initialForm: CreateStorageServerDto = {
  code: "",
  name: "",
  endpoint: "",
  region: "",
  bucketName: "",
  maxTenants: null,
  credentials: { accessKeyId: "", secretAccessKey: "" },
};

const STORAGE_RUNTIME_UPDATE_PERMISSIONS = [
  "admin.settings.read",
  "admin.settings.update",
  "admin.settings.critical",
] as const;

interface StorageRuntimeSetupRequired {
  errorCode: string;
  correlationId?: string;
}

export function useCreateStorageServerScreen() {
  const { lang, dir, t } = useI18n();
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const createIntent = useIdempotency();
  const activationIntent = useIdempotency();

  const [form, setForm] = useState<CreateStorageServerDto>(initialForm);
  const [maxTenants, setMaxTenants] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [storageRuntimeSetupRequired, setStorageRuntimeSetupRequired] =
    useState<StorageRuntimeSetupRequired | null>(null);
  const [pendingActivationId, setPendingActivationId] = useState<string | null>(
    null,
  );

  const c = t.createStorageServer;
  const canRead = adminCan(user, "admin.storage_servers.read");
  const canCreate = adminCanAll(user, ADMIN_RBAC_CRITICAL.STORAGE_SERVERS_CREATE);
  const canActivate = adminCanAll(user, ADMIN_RBAC_CRITICAL.STORAGE_SERVERS_UPDATE);
  const canConfigureStorageRuntime = adminCanAll(
    user,
    STORAGE_RUNTIME_UPDATE_PERMISSIONS,
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setStorageRuntimeSetupRequired(null);
    if (pendingActivationId) {
      await activateCreatedServer(pendingActivationId);
      return;
    }
    const endpoint = form.endpoint.trim();
    if (!isSecureStorageEndpoint(endpoint)) {
      setFormError(c.errors.endpointHttpsOnly);
      return;
    }

    const dto: CreateStorageServerDto = {
      ...form,
      code: form.code.trim().toLowerCase(),
      name: form.name.trim(),
      endpoint: new URL(endpoint).origin,
      region: form.region.trim().toLowerCase(),
      bucketName: form.bucketName.trim().toLowerCase(),
      maxTenants: maxTenants ? Number(maxTenants) : null,
      credentials: {
        accessKeyId: form.credentials.accessKeyId.trim(),
        secretAccessKey: form.credentials.secretAccessKey,
      },
    };

    setIsSubmitting(true);
    try {
      const key = createIntent.getIdempotencyKey({ action: "create", dto });
      const created = await storageServersApi.create(dto, key);
      createIntent.resetKey();
      setForm((current) => ({
        ...current,
        credentials: { accessKeyId: "", secretAccessKey: "" },
      }));
      if (canActivate) {
        setPendingActivationId(created.id);
        await activateCreatedServer(created.id);
        return;
      }
      toast.success(c.success.title, c.success.message);
      router.push(canRead ? `/storage-servers/${created.id}` : "/dashboard");
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (requiresStorageRuntimeSetup(normalized)) {
        if (shouldResetStorageServerWriteKey(normalized)) {
          createIntent.resetKey();
        }
        setStorageRuntimeSetupRequired({
          errorCode: normalized.errorCode,
          ...(normalized.correlationId
            ? { correlationId: normalized.correlationId }
            : {}),
        });
        return;
      }
      if (shouldResetStorageServerWriteKey(normalized)) createIntent.resetKey();
      const message = readErrorMessage(normalized, c.errors.registrationFailed);
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  async function activateCreatedServer(storageServerId: string) {
    setIsSubmitting(true);
    setPendingActivationId(storageServerId);
    try {
      const key = activationIntent.getIdempotencyKey({
        action: "activate",
        storageServerId,
      });
      await storageServersApi.activate(storageServerId, key);
      activationIntent.resetKey();
      setPendingActivationId(null);
      toast.success(c.activation.setupCompleteTitle, c.activation.setupCompleteDescription);
      router.push(canRead ? `/storage-servers/${storageServerId}` : "/dashboard");
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (requiresStorageRuntimeSetup(normalized)) {
        setStorageRuntimeSetupRequired({
          errorCode: normalized.errorCode,
          ...(normalized.correlationId
            ? { correlationId: normalized.correlationId }
            : {}),
        });
        setFormError(null);
        return;
      }
      const definitiveFailure = shouldResetStorageServerWriteKey(normalized);
      if (definitiveFailure) {
        activationIntent.resetKey();
        const recoveryMessage = readErrorMessage(
          normalized,
          canRead
            ? c.activation.recoveryMessageWithAccess
            : c.activation.recoveryMessageNoAccess,
        );
        toast.warning(c.activation.needsAttentionTitle, recoveryMessage);
        if (canRead) {
          setPendingActivationId(null);
          router.push(`/storage-servers/${storageServerId}`);
        } else {
          setFormError(recoveryMessage);
        }
        return;
      }
      setFormError(
        readErrorMessage(normalized, c.activation.ambiguousOutcomeMessage),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    lang,
    dir,
    t,
    c,
    isAuthLoading,
    canCreate,
    canActivate,
    canConfigureStorageRuntime,
    storageRuntimeSetupRequired,
    setupPending: pendingActivationId !== null,
    form,
    setForm,
    maxTenants,
    setMaxTenants,
    isSubmitting,
    formError,
    handleSubmit,
  };
}

function readErrorMessage(value: unknown, fallback: string): string {
  if (typeof value !== "object" || value === null) return fallback;
  const candidate = value as { message?: unknown; correlationId?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : fallback;
  return typeof candidate.correlationId === "string"
    ? `${message}\nCorrelation ID: ${candidate.correlationId}`
    : message;
}
