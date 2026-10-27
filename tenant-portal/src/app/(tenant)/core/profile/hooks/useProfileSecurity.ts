"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  axiosClient,
  commitTenantSessionResponse,
  getStoredTenantSessionMeta,
  readWebAuthSessionResponse,
  withTenantAuthLock,
} from "@/lib/api/axiosClient";
import { writeCoreData } from "@/lib/api/envelope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { parseTenantUser, USER_NAME_MAX_LENGTH } from "../../contracts/user-contract";

// ChangePasswordDto / common/security/password-policy.ts in Core.
const MAX_PASSWORD_LENGTH = 128;

export function useProfileSecurity() {
  const { user, retryBootstrap } = useTenantAuth();
  const { t } = useI18n();
  const toast = useToast();
  const copy = t.coreIdentity.profile;
  const busy = useRef(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<"name" | "password" | null>(null);
  const [nameError, setNameError] = useState<NormalizedApiError | null>(null);
  const [passwordError, setPasswordError] = useState<NormalizedApiError | null>(null);
  const isNameValid = firstName.trim().length > 0 && lastName.trim().length > 0 &&
    firstName.trim().length <= USER_NAME_MAX_LENGTH && lastName.trim().length <= USER_NAME_MAX_LENGTH;
  const isPasswordValid = newPassword.length >= 12 && newPassword.length <= MAX_PASSWORD_LENGTH &&
    /[a-z]/u.test(newPassword) && /[A-Z]/u.test(newPassword) && /\d/u.test(newPassword) && /[^A-Za-z0-9]/u.test(newPassword);
  const isConfirmed = newPassword.length > 0 && newPassword === confirmPassword;

  function report(caught: unknown): NormalizedApiError {
    const error = normalizeApiError(caught);
    if (error.status === 0) error.message = copy.securityFailed;
    if (error.status !== 403 && !toast.outcomeFromApi(error)) toast.errorFromApi(copy.securityFailed, error);
    return error;
  }

  async function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !user || !isNameValid) return;
    busy.current = true;
    setPending("name");
    setNameError(null);
    try {
      const updated = parseTenantUser(await writeCoreData("patch", "/api/tenant/core/v1/users/me", {
        firstName: firstName.trim(), lastName: lastName.trim(),
      }, { nonReplayable: true }));
      if (updated.id !== user.id) throw new Error("INVALID_CORE_RESPONSE");
      setFirstName(updated.firstName);
      setLastName(updated.lastName);
      toast.success(copy.nameSaved);
      await retryBootstrap();
    } catch (caught) {
      setNameError(report(caught));
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !user || !currentPassword || !isPasswordValid || !isConfirmed) return;
    busy.current = true;
    setPending("password");
    setPasswordError(null);
    try {
      await withTenantAuthLock(async (signal) => {
        const previous = getStoredTenantSessionMeta();
        if (!previous) throw new Error("AUTH_SESSION_CHANGED");
        const response = await axiosClient.post("/api/tenant/core/v1/auth/change-password", {
          currentPassword, newPassword,
        }, { nonReplayable: true, skipAutoIdempotency: true, skipAuthRefresh: true, cache: "no-store", signal });
        const auth = readWebAuthSessionResponse(response.data);
        if (!auth || auth.session.id !== previous.sessionId) throw new Error("INVALID_AUTH_SESSION");
        commitTenantSessionResponse(auth, { remember: previous.remember, notifyCurrentTab: false });
      });
      toast.success(copy.passwordSaved);
      await retryBootstrap();
    } catch (caught) {
      setPasswordError(report(caught));
    } finally {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      busy.current = false;
      setPending(null);
    }
  }

  return {
    t, firstName, setFirstName, lastName, setLastName, currentPassword, setCurrentPassword,
    newPassword, setNewPassword, confirmPassword, setConfirmPassword, showPassword,
    toggleShowPassword: () => setShowPassword((value) => !value),
    pending, nameError, passwordError, isNameValid, isPasswordValid, isConfirmed,
    submitName, submitPassword, maxNameLength: USER_NAME_MAX_LENGTH, maxPasswordLength: MAX_PASSWORD_LENGTH,
  };
}
