"use client";

import { useState } from "react";
import {
  DatabaseServerSslConfigDto,
  DatabaseServerSslMode,
  DatabaseServerView,
  UpdateDatabaseServerDto,
} from "../types";
import { databaseServersApi } from "../api/database-servers.api";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { useToast } from "@/components/ui/ToastContext";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useI18n } from "@/i18n/I18nContext";
import { Edit2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
} from "@/design-system";
import { DatabaseSslConfigurationFields } from "./DatabaseSslConfigurationFields";
import {
  compactDatabaseSslConfig,
  validateDatabaseSslConfig,
} from "../lib/database-ssl-config";

interface EditDatabaseServerModalProps {
  isOpen: boolean;
  server: DatabaseServerView;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditDatabaseServerModal({
  isOpen,
  server,
  onClose,
  onSuccess,
}: EditDatabaseServerModalProps) {
  if (!isOpen) return null;

  return (
    <EditDatabaseServerModalContent
      key={`${server.id}:${server.updatedAt}`}
      server={server}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

function EditDatabaseServerModalContent({
  server,
  onClose,
  onSuccess,
}: Omit<EditDatabaseServerModalProps, "isOpen">) {
  const toast = useToast();
  const { t } = useI18n();
  const copy = t.databaseServerDetail.editModal;
  const { getIdempotencyKey, resetKey } = useIdempotency();

  const [name, setName] = useState(server.name);
  const [host, setHost] = useState(server.host);
  const [port, setPort] = useState(server.port);
  const [maxTenants, setMaxTenants] = useState(server.maxTenants);
  const [countryName, setCountryName] = useState(server.countryName || "");
  const [sslMode, setSslMode] = useState<DatabaseServerSslMode>(server.sslMode);
  const [sslRejectUnauthorized, setSslRejectUnauthorized] = useState(
    server.sslRejectUnauthorized,
  );
  const [sslConfig, setSslConfig] = useState<DatabaseServerSslConfigDto>({});
  const [removeSslConfig, setRemoveSslConfig] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sslErrors = validateDatabaseSslConfig({
      mode: sslMode,
      config: sslConfig,
      hasStoredConfig: server.hasSslConfig,
      removeStoredConfig: removeSslConfig,
    });
    if (sslErrors.length > 0) {
      toast.error(copy.invalidSslTitle, sslErrors[0]);
      return;
    }

    setIsSubmitting(true);

    const replacementSslConfig = compactDatabaseSslConfig(sslConfig);

    const dto: UpdateDatabaseServerDto = {
      name,
      host,
      port: Number(port),
      maxTenants: Number(maxTenants),
      ...(countryName ? { countryName } : {}),
      ...(sslMode !== server.sslMode ? { sslMode } : {}),
      ...(sslRejectUnauthorized !== server.sslRejectUnauthorized
        ? { sslRejectUnauthorized }
        : {}),
      ...(replacementSslConfig
        ? { sslConfig: replacementSslConfig }
        : removeSslConfig && server.hasSslConfig
          ? { removeSslConfig: true }
          : {}),
    };

    try {
      const key = getIdempotencyKey(dto);
      await databaseServersApi.update(server.id, dto, key);
      toast.success(copy.successTitle, copy.successDescription);
      resetKey();
      onSuccess();
      onClose();
    } catch (err) {
      const normalized = normalizeApiError(err);
      toast.error(copy.failureTitle, normalized.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="flex-row items-center gap-2.5 space-y-0">
          <span className="rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
            <Edit2 className="w-5 h-5" aria-hidden="true" />
          </span>
          <DialogTitle className="text-base">{copy.title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <Field label={copy.displayName}>
            {(fieldProps) => (
              <Input {...fieldProps} type="text" required value={name} onChange={(e) => setName(e.target.value)} className="font-semibold" />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={copy.hostAddress}>
              {(fieldProps) => (
                <Input {...fieldProps} type="text" required value={host} onChange={(e) => setHost(e.target.value)} className="font-mono font-semibold" />
              )}
            </Field>
            <Field label={copy.port}>
              {(fieldProps) => (
                <Input {...fieldProps} type="number" required value={port} onChange={(e) => setPort(Number(e.target.value))} className="font-mono font-semibold" />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={copy.maxTenants}>
              {(fieldProps) => (
                <Input {...fieldProps} type="number" required min={1} value={maxTenants} onChange={(e) => setMaxTenants(Number(e.target.value))} className="font-mono font-semibold" />
              )}
            </Field>
            <Field label={copy.countryLocation}>
              {(fieldProps) => (
                <Input {...fieldProps} type="text" value={countryName} onChange={(e) => setCountryName(e.target.value)} placeholder={copy.countryPlaceholder} className="font-semibold" />
              )}
            </Field>
          </div>

          <DatabaseSslConfigurationFields
            idPrefix="edit-database-server-ssl"
            mode={sslMode}
            rejectUnauthorized={sslRejectUnauthorized}
            config={sslConfig}
            hasStoredConfig={server.hasSslConfig}
            removeStoredConfig={removeSslConfig}
            onModeChange={(nextMode) => {
              setSslMode(nextMode);
              if (nextMode === "disable") {
                setSslConfig({});
                setRemoveSslConfig(server.hasSslConfig);
              } else if (sslMode === "disable") {
                setRemoveSslConfig(false);
              }
            }}
            onRejectUnauthorizedChange={setSslRejectUnauthorized}
            onConfigChange={setSslConfig}
            onRemoveStoredConfigChange={setRemoveSslConfig}
            disabled={isSubmitting}
          />

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {copy.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? copy.saving : copy.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
