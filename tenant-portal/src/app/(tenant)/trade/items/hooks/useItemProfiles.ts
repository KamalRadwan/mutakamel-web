"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { tradeIfMatch, tradePatch, tradePost } from "../../trade-api";
import {
  canPerformTradeAction,
  TRADE_CONCURRENCY_CODES,
  TRADE_PERMISSIONS,
} from "../../trade-scope";
import { useTradeScopeRequest } from "../../useTradeScope";
import { useTradeWrite } from "../../useTradeWrite";
import {
  BRANCH_MISMATCH_CODE,
  BRANCH_PROFILE_EXISTS_CODE,
  CAPABILITY_INCOMPATIBLE_CODE,
  COMPANY_PROFILE_EXISTS_CODE,
  COMPANY_PROFILE_INVALID_CODE,
  branchProfilePath,
  buildBranchProfileRequest,
  buildCompanyProfileRequest,
  companyProfilePath,
  type BranchProfileFormValues,
  type CompanyProfileFormValues,
  type ItemBranchProfile,
  type ItemCompanyProfile,
} from "../item-profile-contract";

/**
 * The two profile upserts. Both are the SAME permission at two different
 * scopes — `trade.items.manage` at `COMPANY` and at `BRANCH` — and
 * `TradePermissionsGuard` matches the scope target exactly, so holding one
 * does not imply the other. Each half therefore has its own scope gap and its
 * own optimistic enable.
 */
export function useItemProfiles(
  itemId: string,
  companyProfile: ItemCompanyProfile | null,
  branchProfile: ItemBranchProfile | null,
  onSaved: () => void,
) {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const runWrite = useTradeWrite();
  const canManage = canPerformTradeAction(user, TRADE_PERMISSIONS.itemsManage);
  const company = useTradeScopeRequest("COMPANY");
  const branch = useTradeScopeRequest("BRANCH");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyFormError, setCompanyFormError] = useState<string | null>(null);
  const [branchFormError, setBranchFormError] = useState<string | null>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);

  const describe = useCallback(
    (error: NormalizedApiError): string | undefined => {
      if (error.code === COMPANY_PROFILE_EXISTS_CODE) return t.trade.companyProfileExists;
      if (error.code === COMPANY_PROFILE_INVALID_CODE) return t.trade.companyProfileInvalid;
      if (error.code === CAPABILITY_INCOMPATIBLE_CODE) return t.trade.capabilityIncompatible;
      if (error.code === BRANCH_PROFILE_EXISTS_CODE) return t.trade.branchProfileExists;
      if (error.code === BRANCH_MISMATCH_CODE) return t.trade.branchMismatch;
      return undefined;
    },
    [t],
  );

  const finish = useCallback(
    (replayed: boolean) => {
      toast.success(
        t.trade.savedTitle,
        replayed ? t.trade.replayedDescription : t.trade.savedDescription,
      );
      onSaved();
    },
    [toast, t, onSaved],
  );

  const saveCompanyProfile = useCallback(
    async (values: CompanyProfileFormValues): Promise<boolean> => {
      if (!canManage || company.gap || isSubmitting) return false;
      setIsSubmitting(true);
      setCompanyFormError(null);
      try {
        const request = buildCompanyProfileRequest(values);
        const outcome = await runWrite(
          () =>
            companyProfile
              ? tradePatch(companyProfilePath(itemId), request, {
                  headers: {
                    ...company.headers,
                    "if-match": tradeIfMatch(companyProfile.version),
                  },
                })
              : tradePost(companyProfilePath(itemId), request, { headers: company.headers }),
          { failureTitle: t.trade.companyProfileSave, describe },
        );
        // A 409 `TRADE.CONCURRENCY.STALE_VERSION` means someone else moved
        // the row. Trade has no force-write path, so the only honest
        // response is to refetch and let the user see the server's value.
        if (!outcome.ok) {
          if (outcome.error?.code === TRADE_CONCURRENCY_CODES.staleVersion) onSaved();
          return false;
        }
        setCompanyOpen(false);
        finish(outcome.replayed);
        return true;
      } catch (error) {
        setCompanyFormError(profileMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      canManage,
      company,
      isSubmitting,
      runWrite,
      companyProfile,
      itemId,
      describe,
      t,
      finish,
      onSaved,
    ],
  );

  const saveBranchProfile = useCallback(
    async (values: BranchProfileFormValues): Promise<boolean> => {
      if (!canManage || branch.gap || isSubmitting) return false;
      setIsSubmitting(true);
      setBranchFormError(null);
      try {
        const request = buildBranchProfileRequest(values);
        const outcome = await runWrite(
          () =>
            branchProfile
              ? tradePatch(branchProfilePath(itemId), request, {
                  headers: { ...branch.headers, "if-match": tradeIfMatch(branchProfile.version) },
                })
              : tradePost(branchProfilePath(itemId), request, { headers: branch.headers }),
          { failureTitle: t.trade.branchProfileSave, describe },
        );
        if (!outcome.ok) {
          if (outcome.error?.code === TRADE_CONCURRENCY_CODES.staleVersion) onSaved();
          return false;
        }
        setBranchOpen(false);
        finish(outcome.replayed);
        return true;
      } catch (error) {
        setBranchFormError(profileMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      canManage,
      branch,
      isSubmitting,
      runWrite,
      branchProfile,
      itemId,
      describe,
      t,
      finish,
      onSaved,
    ],
  );

  return {
    canManage,
    companyScopeGap: company.gap,
    branchScopeGap: branch.gap,
    isSubmitting,
    companyFormError,
    branchFormError,
    companyOpen,
    branchOpen,
    openCompany: () => {
      setCompanyFormError(null);
      setCompanyOpen(true);
    },
    closeCompany: () => {
      if (isSubmitting) return;
      setCompanyOpen(false);
    },
    openBranch: () => {
      setBranchFormError(null);
      setBranchOpen(true);
    },
    closeBranch: () => {
      if (isSubmitting) return;
      setBranchOpen(false);
    },
    saveCompanyProfile,
    saveBranchProfile,
  };
}

type Dictionary = ReturnType<typeof useI18n>["t"];

function profileMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "PROFILE_FORM_CAPABILITY") return t.trade.capabilitySetHint;
  if (reason === "PROFILE_FORM_RESTRICTIONS") return t.trade.restrictionsHint;
  if (reason === "PROFILE_FORM_UOM" || reason === "PROFILE_FORM_NODE") return t.trade.itemFormUom;
  return t.trade.jsonInvalid;
}
