import { useMemo, useState, type FormEvent } from "react";
import { useToast, type ComboboxOption } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { isExactMoneyDecimal, toMoneyWireNumber } from "../../../../shared/money";
import { OPPORTUNITIES_PATH, parseOpportunityDetailResponse } from "../../../opportunity-contract";
import { useOpportunityCurrencyOptions } from "../../../hooks/useCreateOpportunity";
import { useCustomerProfileOptions } from "../../../hooks/useCustomerProfileOptions";
import { opportunityCapabilityAllowsOwner } from "../../../hooks/usePipelineWorkspace";
import type { OpportunityBoardQuickAddProps, QuickCreateOpportunityDraft } from "../opportunity-board-types";

export function useOpportunityBoardQuickAdd({
  pipeline, stage, branchId, createCapability, onCreated, onForbidden, onOpenFullForm,
}: OpportunityBoardQuickAddProps) {
  const { t } = useI18n();
  const toast = useToast();

  const [customerProfileId, setCustomerProfileId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const currencyOptions = useOpportunityCurrencyOptions(true);
  const [probabilityPercent, setProbabilityPercent] = useState("50");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [importance, setImportance] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const customers = useCustomerProfileOptions(branchId, true);
  const customerOptions: ComboboxOption[] = useMemo(
    () =>
      customers.items
        .filter((item) =>
          opportunityCapabilityAllowsOwner(createCapability, item.ownerUserId),
        )
        .map((item) => ({
          value: item.id,
          label: item.displayName,
          description:
            item.companyName && item.companyName !== item.displayName
              ? item.companyName
              : undefined,
        })),
    [customers.items, createCapability],
  );

  function buildDraft(): QuickCreateOpportunityDraft {
    return {
      customerProfileId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      title,
      amount,
      currencyCode,
      probabilityPercent,
      expectedCloseDate,
      importance: String(importance),
    };
  }

  async function handleQuickSubmit(e: FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    setErrorMsg(null);

    if (!customerProfileId) {
      setErrorMsg(
        t.crmOpportunities.customerRequired,
      );
      return;
    }
    if (!title.trim()) {
      setErrorMsg(
        t.crmOpportunities.titleRequired,
      );
      return;
    }
    const trimmedAmount = amount.trim();
    if (trimmedAmount.length > 0 && !isExactMoneyDecimal(trimmedAmount, currencyCode)) {
      setErrorMsg(t.crmShared.refusals.CRM_AMOUNT_SCALE_INVALID);
      return;
    }

    setIsSaving(true);
    try {
      const wireAmount = toMoneyWireNumber(trimmedAmount, currencyCode);
      const parsedProb = probabilityPercent.trim()
        ? Number(probabilityPercent.trim())
        : undefined;
      const body: Record<string, unknown> = {
        branchId,
        customerProfileId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        title: title.trim(),
        importance,
      };
      if (wireAmount !== undefined) {
        body.amount = wireAmount;
      }
      if (currencyCode) body.currencyCode = currencyCode;
      if (
        parsedProb !== undefined &&
        Number.isSafeInteger(parsedProb) &&
        parsedProb >= 0 &&
        parsedProb <= 100
      ) {
        body.probabilityPercent = parsedProb;
      }
      if (expectedCloseDate.trim()) {
        body.expectedCloseDate = expectedCloseDate.trim();
      }

      const attempt = createWriteAttempt();
      const outcome = await runIdempotentWrite({
        attempt,
        method: "post",
        path: OPPORTUNITIES_PATH,
        body,
        parse: parseOpportunityDetailResponse,
      });

      if (outcome.kind === "success" || outcome.kind === "applied_unreadable") {
        toast.success(
          t.crmOpportunityDetail.createOperation,
          title.trim(),
        );
        onCreated();
      } else {
        if (outcome.error.status === 403) {
          setIsForbidden(true);
          onForbidden?.();
        }
        setErrorMsg(outcome.error.message ?? t.crmOpportunities.cardUpdateFailed);
      }
    } catch {
      setErrorMsg(t.crmOpportunities.cardUpdateFailed);
    } finally {
      setIsSaving(false);
    }
  }

  return {
    customerProfileId, setCustomerProfileId, title, setTitle, amount, setAmount,
    currencyCode, setCurrencyCode, currencyOptions, probabilityPercent,
    setProbabilityPercent, expectedCloseDate, setExpectedCloseDate,
    importance, setImportance, isSaving, errorMsg, isForbidden, customers, customerOptions,
    submit: (event: FormEvent) => { void handleQuickSubmit(event); },
    openFullForm: () => onOpenFullForm(buildDraft()),
  };
}
