"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { CUSTOMER_PROFILE_CREATE_LIMITS } from "../../customer-profile-create-contract";
import type { CustomerBoardQuickAddProps } from "./customer-board-types";
import { useCustomerBoardQuickAddState } from "./useCustomerBoardQuickAddState";
import { useCustomerBoardQuickSave } from "./useCustomerBoardQuickSave";
export function useCustomerBoardQuickAdd(props: CustomerBoardQuickAddProps) {
  const state = useCustomerBoardQuickAddState(props.branchId);
  const handleQuickSave = useCustomerBoardQuickSave(props, state);
  const { status, onOpenFullModal } = props;
  const { profileType, sourceId, firstName, lastName, individualPhones, companyMode,
    selectedCompany, selectedCompanyName, companyName, companyPhones, contactFirstName,
    contactLastName, contactPhones } = state;
  function handleOpenFullModal() {
    onOpenFullModal({
      profileType,
      status,
      acquisitionSourceId: sourceId,
      firstName,
      lastName,
      phones: individualPhones.length > 0 ? [...individualPhones] : [""],
      companyName:
        companyMode === "existing"
          ? selectedCompany?.displayName || selectedCompanyName || ""
          : companyName,
      companyPhones:
        companyMode === "new" && companyPhones.length > 0
          ? [...companyPhones]
          : [""],
      contactFirstName,
      contactLastName,
      contactPhones: contactPhones.length > 0 ? [...contactPhones] : [""],
    });
  }

  function onNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") void handleQuickSave();
    if (event.key === "Escape") props.onCancel();
  }
  const textFields = {
    firstName: state.setFirstName, lastName: state.setLastName, companyName: state.setCompanyName,
    contactFirstName: state.setContactFirstName, contactLastName: state.setContactLastName,
  };
  function textField(key: keyof typeof textFields) {
    return {
      value: state[key],
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        textFields[key](event.target.value);
        state.clearError(key);
      },
      onKeyDown: onNameKeyDown,
    };
  }
  const phoneFields = {
    individualPhones: state.setIndividualPhones, companyPhones: state.setCompanyPhones,
    contactPhones: state.setContactPhones,
  };
  function phoneField(key: keyof typeof phoneFields) {
    const path = key === "individualPhones" ? "phones" : key;
    return {
      phones: state[key], path, errors: state.errors, disabled: state.isSubmitting,
      onChange: (index: number, value: string) => {
        phoneFields[key]((current) => current.map((phone, i) => i === index ? value : phone));
        state.clearError(path);
      },
      onAdd: () => phoneFields[key]((current) => current.length < CUSTOMER_PROFILE_CREATE_LIMITS.phones ? [...current, ""] : current),
      onRemove: (index: number) => phoneFields[key]((current) => current.length > 1 ? current.filter((_, i) => i !== index) : [""]),
      onBlur: () => {},
    };
  }
  function changeProfileType(next: typeof profileType) {
    state.setProfileType(next);
    state.setErrors({});
  }
  function changeCompanyMode(next: typeof companyMode) {
    state.setCompanyMode(next);
    if (next === "new") {
      state.setExistingCompanyPartyId("");
      state.setSelectedCompanyName("");
      state.setCompanyQuery("");
      void state.companyLookup.selectCompany(null);
    }
    state.setErrors({});
  }
  function selectCompany(id: string | null) {
    const nextId = id ?? "";
    const matched = state.companyLookup.companies.find((company) => company.id === nextId);
    state.setExistingCompanyPartyId(nextId);
    state.setSelectedCompanyName(matched?.displayName ?? "");
    state.setCompanyQuery("");
    void state.companyLookup.selectCompany(nextId || null);
    state.clearError("existingCompanyPartyId");
  }
  function selectSource(value: string) {
    state.setSourceId(value);
    state.clearError("acquisitionSourceId");
  }
  return {
    profileType, companyMode, sourceId, selectedCompany, selectedCompanyName,
    errors: state.errors, isSubmitting: state.isSubmitting, rating: state.rating,
    setRating: state.setRating, companyLookup: state.companyLookup,
    companyComboboxOptions: state.companyComboboxOptions,
    existingCompanyPartyId: state.existingCompanyPartyId, setCompanyQuery: state.setCompanyQuery,
    handleQuickSave, handleOpenFullModal, textField, phoneField,
    changeProfileType, changeCompanyMode, selectCompany, selectSource,
  };

}
