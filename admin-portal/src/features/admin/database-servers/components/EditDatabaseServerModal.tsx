"use client";

import { useEffect, useRef } from "react";
import { DatabaseServerView } from "../types";
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
import { useEditDatabaseServerModal } from "../hooks/useEditDatabaseServerModal";
import { useI18n } from "@/i18n/I18nContext";

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
  const { dir } = useI18n();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const {
    copy,
    name,
    setName,
    host,
    setHost,
    port,
    setPort,
    maxTenants,
    setMaxTenants,
    countryName,
    setCountryName,
    sslMode,
    sslRejectUnauthorized,
    setSslRejectUnauthorized,
    sslConfig,
    setSslConfig,
    removeSslConfig,
    setRemoveSslConfig,
    isSubmitting,
    formError,
    handleSslModeChange,
    handleSubmit,
  } = useEditDatabaseServerModal({ server, onClose, onSuccess });

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent dir={dir} className="max-h-[90vh] max-w-2xl overflow-y-auto p-3 sm:p-3.5">
        <DialogHeader className="flex-row items-center gap-2 space-y-0 pb-2 border-b border-border">
          <span className="rounded-lg bg-info-subtle p-1.5 text-info-subtle-foreground">
            <Edit2 className="size-3.5" aria-hidden="true" />
          </span>
          <DialogTitle className="text-sm font-semibold">{copy.title}</DialogTitle>
        </DialogHeader>

        <form method="post" onSubmit={handleSubmit} className="space-y-2.5 text-xs">
          {formError && (
            <p
              ref={errorRef}
              role="alert"
              tabIndex={-1}
              className="rounded-md border border-destructive/30 bg-destructive-subtle px-2.5 py-1.5 text-xs font-semibold text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {formError}
            </p>
          )}

          <Field label={copy.displayName} hideLabel required>
            {(fieldProps) => (
              <Input {...fieldProps} size="sm" type="text" required placeholder={`${copy.displayName} *`} value={name} onChange={(e) => setName(e.target.value)} className="font-semibold" />
            )}
          </Field>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label={copy.hostAddress} hideLabel required>
              {(fieldProps) => (
                <Input {...fieldProps} size="sm" type="text" required placeholder={`${copy.hostAddress} *`} value={host} onChange={(e) => setHost(e.target.value)} className="font-mono" />
              )}
            </Field>
            <Field label={copy.port} hideLabel required>
              {(fieldProps) => (
                <Input {...fieldProps} size="sm" type="number" required placeholder={`${copy.port} *`} value={port} onChange={(e) => setPort(Number(e.target.value))} className="font-mono" />
              )}
            </Field>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label={copy.maxTenants} hideLabel required>
              {(fieldProps) => (
                <Input {...fieldProps} size="sm" type="number" required min={1} placeholder={`${copy.maxTenants} *`} value={maxTenants} onChange={(e) => setMaxTenants(Number(e.target.value))} className="font-mono" />
              )}
            </Field>
            <Field label={copy.countryLocation} hideLabel>
              {(fieldProps) => (
                <Input {...fieldProps} size="sm" type="text" value={countryName} onChange={(e) => setCountryName(e.target.value)} placeholder={copy.countryLocation || copy.countryPlaceholder} />
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
            onModeChange={handleSslModeChange}
            onRejectUnauthorizedChange={setSslRejectUnauthorized}
            onConfigChange={setSslConfig}
            onRemoveStoredConfigChange={setRemoveSslConfig}
            disabled={isSubmitting}
          />

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              {copy.cancel}
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={isSubmitting}>
              {copy.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
