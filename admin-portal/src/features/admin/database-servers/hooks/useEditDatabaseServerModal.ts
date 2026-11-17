import { useState, type FormEvent } from "react";
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
import {
  compactDatabaseSslConfig,
  validateDatabaseSslConfig,
} from "../lib/database-ssl-config";
import {
  DATABASE_SECURITY_ADMIN_USERNAME_PATTERN,
  DATABASE_SERVER_CREATE_CONSTRAINTS,
  isDatabaseSecurityAdminStepValid,
} from "../lib/registration-state";

interface UseEditDatabaseServerModalOptions {
  server: DatabaseServerView;
  onClose: () => void;
  onSuccess: () => void;
}

export function useEditDatabaseServerModal({
  server,
  onClose,
  onSuccess,
}: UseEditDatabaseServerModalOptions) {
  const toast = useToast();
  const { t } = useI18n();
  const copy = t.databaseServerDetail.editModal;
  const { getIdempotencyKey, resetKey } = useIdempotency();

  const [name, setName] = useState(server.name);
  const [host, setHost] = useState(server.host);
  const [port, setPort] = useState(server.port);
  const [maxTenants, setMaxTenants] = useState(server.maxTenants);
  const [countryName, setCountryName] = useState(server.countryName || "");
  const [securityAdminUsername, setSecurityAdminUsername] = useState("");
  const [securityAdminPassword, setSecurityAdminPassword] = useState("");
  const [showSecurityAdminPassword, setShowSecurityAdminPassword] = useState(false);
  const [credentialsValidationAttempted, setCredentialsValidationAttempted] = useState(false);
  const [sslMode, setSslMode] = useState<DatabaseServerSslMode>(server.sslMode);
  const [sslRejectUnauthorized, setSslRejectUnauthorized] = useState(
    server.sslRejectUnauthorized,
  );
  const [sslConfig, setSslConfig] = useState<DatabaseServerSslConfigDto>({});
  const [removeSslConfig, setRemoveSslConfig] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const normalizedUsername = securityAdminUsername.trim();
  const credentialsRequested = normalizedUsername.length > 0 || securityAdminPassword.length > 0;
  const usernameError = credentialsValidationAttempted && credentialsRequested &&
    !DATABASE_SECURITY_ADMIN_USERNAME_PATTERN.test(normalizedUsername)
    ? copy.invalidSecurityAdminUsername
    : undefined;
  const passwordError = credentialsValidationAttempted && credentialsRequested &&
    (securityAdminPassword.length < DATABASE_SERVER_CREATE_CONSTRAINTS.securityAdminPassword.minLength ||
      securityAdminPassword.length > DATABASE_SERVER_CREATE_CONSTRAINTS.securityAdminPassword.maxLength)
    ? copy.invalidSecurityAdminPassword
    : undefined;

  const handleSslModeChange = (nextMode: DatabaseServerSslMode) => {
    setSslMode(nextMode);
    if (nextMode === "disable") {
      setSslConfig({});
      setRemoveSslConfig(server.hasSslConfig);
    } else if (sslMode === "disable") {
      setRemoveSslConfig(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const replacementCredentials = credentialsRequested
      ? { username: normalizedUsername, password: securityAdminPassword }
      : undefined;
    setCredentialsValidationAttempted(true);
    if (replacementCredentials && !isDatabaseSecurityAdminStepValid(replacementCredentials)) {
      setFormError(copy.credentialsError);
      return;
    }
    const sslErrors = validateDatabaseSslConfig({
      mode: sslMode,
      config: sslConfig,
      hasStoredConfig: server.hasSslConfig,
      removeStoredConfig: removeSslConfig,
    });
    if (sslErrors.length > 0) {
      setFormError(`${copy.invalidSslTitle}: ${sslErrors[0]}`);
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    const replacementSslConfig = compactDatabaseSslConfig(sslConfig);

    const dto: UpdateDatabaseServerDto = {
      name,
      host,
      port: Number(port),
      maxTenants: Number(maxTenants),
      ...(countryName ? { countryName } : {}),
      ...(replacementCredentials ? { securityAdminCredentials: replacementCredentials } : {}),
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
      setFormError(`${copy.failureTitle}: ${normalized.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
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
    securityAdminUsername,
    setSecurityAdminUsername,
    securityAdminPassword,
    setSecurityAdminPassword,
    showSecurityAdminPassword,
    setShowSecurityAdminPassword,
    credentialsRequested,
    usernameError,
    passwordError,
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
  };
}
