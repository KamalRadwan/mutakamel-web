"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import {
  buildResolveExceptionRequest,
  controlTowerFormMessage,
} from "../../control-tower-contract";

export function useExceptionResolution(
  onConfirm: (request: ReturnType<typeof buildResolveExceptionRequest>) => void,
  loading: boolean,
) {
  const { t } = useI18n();
  const [resolutionCode, setResolutionCode] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | undefined>();
  const canConfirm = resolutionCode !== "" && reason.trim().length > 0 && !loading;

  function confirm() {
    if (!canConfirm) return;
    try {
      const request = buildResolveExceptionRequest(resolutionCode, reason, evidence);
      setError(undefined);
      onConfirm(request);
    } catch (cause) {
      setError(controlTowerFormMessage(cause, t));
    }
  }

  return {
    resolutionCode, setResolutionCode,
    reason, setReason,
    evidence, setEvidence,
    error, canConfirm, confirm,
  };
}
