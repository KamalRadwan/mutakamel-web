"use client";

import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { CrmErrorBag } from "../../../shared/crm-form-validation";
import { useCrmFieldMessages } from "../../../shared/hooks/useCrmFieldMessages";
import { parseCustomerProfileDetailResponse } from "../../customer-profile-contract";
import { CUSTOMER_PROFILE_CREATE_LIMITS, buildCreateCustomerProfileFullRequest, emptyCreateCustomerProfileForm } from "../../customer-profile-create-contract";
import { CUSTOMER_PROFILES_PATH, customerProfilePath } from "../../hooks/useCustomerProfiles";
import type { CustomerBoardQuickAddProps } from "./customer-board-types";
import type { useCustomerBoardQuickAddState } from "./useCustomerBoardQuickAddState";
export function useCustomerBoardQuickSave({ status, branchId, sources, onCreated }: CustomerBoardQuickAddProps,
  state: ReturnType<typeof useCustomerBoardQuickAddState>) {
  const { t } = useI18n();
  const toast = useToast();
  const fieldMessages = useCrmFieldMessages();
  const { profileType, companyMode, existingCompanyPartyId, selectedCompany, selectedCompanyName,
    companyName, companyPhones, contactFirstName, contactLastName, contactPhones, firstName,
    lastName, individualPhones, sourceId, rating, isSubmitting, setErrors, setIsSubmitting } = state;
  async function handleQuickSave() {
    if (isSubmitting) return;
    const bag = new CrmErrorBag(fieldMessages);
    if (sources.length > 0) {
      bag.required("acquisitionSourceId", sourceId);
    }
    if (profileType === "CORPORATE") {
      if (companyMode === "existing") {
        bag.required("existingCompanyPartyId", existingCompanyPartyId);
      } else {
        if (bag.required("companyName", companyName)) {
          bag.maxLength(
            "companyName",
            companyName,
            CUSTOMER_PROFILE_CREATE_LIMITS.companyName,
          );
        }
        bag.phones("companyPhones", companyPhones);
      }
      if (bag.required("contactFirstName", contactFirstName)) {
        bag.maxLength(
          "contactFirstName",
          contactFirstName,
          CUSTOMER_PROFILE_CREATE_LIMITS.firstName,
        );
      }
      bag.maxLength(
        "contactLastName",
        contactLastName,
        CUSTOMER_PROFILE_CREATE_LIMITS.lastName,
      );
      bag.phones("contactPhones", contactPhones);
    } else {
      if (bag.required("firstName", firstName)) {
        bag.maxLength(
          "firstName",
          firstName,
          CUSTOMER_PROFILE_CREATE_LIMITS.firstName,
        );
      }
      if (bag.required("lastName", lastName)) {
        bag.maxLength(
          "lastName",
          lastName,
          CUSTOMER_PROFILE_CREATE_LIMITS.lastName,
        );
      }
      bag.phones("phones", individualPhones);
    }
    if (Object.keys(bag.errors).length > 0) {
      setErrors(bag.errors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      const draft = emptyCreateCustomerProfileForm("quick-contact-1");
      draft.profileType = profileType;
      draft.status = status;
      draft.acquisitionSourceId = sourceId;
      if (profileType === "CORPORATE") {
        const resolvedCompanyName =
          companyMode === "existing"
            ? (selectedCompany?.displayName || selectedCompanyName).trim()
            : companyName.trim();
        draft.companyName = resolvedCompanyName;
        draft.companyPhones =
          companyMode === "new" && companyPhones.length > 0
            ? [...companyPhones]
            : [""];
        const composedContactName = [
          contactFirstName.trim(),
          contactLastName.trim(),
        ]
          .filter(Boolean)
          .join(" ");
        draft.contacts = [
          {
            key: "quick-contact-1",
            honorificTitle: "",
            firstName: contactFirstName.trim(),
            lastName: contactLastName.trim(),
            fullName: composedContactName,
            jobTitle: "",
            email: "",
            phones: contactPhones.length > 0 ? [...contactPhones] : [""],
            isPrimary: true,
          },
        ];
      } else {
        draft.firstName = firstName.trim();
        draft.lastName = lastName.trim();
        draft.phones =
          individualPhones.length > 0 ? [...individualPhones] : [""];
      }
      const body = buildCreateCustomerProfileFullRequest(draft, branchId);
      const outcome = await runIdempotentWrite({
        attempt: createWriteAttempt(),
        method: "post",
        path: CUSTOMER_PROFILES_PATH,
        body,
        parse: parseCustomerProfileDetailResponse,
        config: { maxResponseBytes: 512 * 1024 },
      });
      if (outcome.kind === "success") {
        let ratingFollowUpFailed = false;
        if (rating > 0) {
          try {
            await axiosClient.patch(
              customerProfilePath(outcome.value.id),
              { rating },
              {
                nonReplayable: true,
                skipAutoIdempotency: true,
                cache: "no-store",
              },
            );
          } catch (error) {
            ratingFollowUpFailed = normalizeApiError(error).status !== 403;
          }
        }
        toast.success(
          t.crmCustomerProfiles.ui.board.customer_created,
          outcome.value.displayName,
        );
        if (ratingFollowUpFailed) {
          toast.warning(
            t.crmCustomerProfiles.followUpWarningTitle,
            t.crmCustomerProfiles.followUpWarningMessage,
          );
        }
        onCreated();
      } else {
        toast.errorFromApi(
          t.crmCustomerProfiles.ui.board.unable_to_create_customer,
          outcome.error,
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return handleQuickSave;
}
