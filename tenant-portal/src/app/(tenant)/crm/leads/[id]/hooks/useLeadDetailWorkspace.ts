"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { crmCapabilityAllowsOwner } from "../../../shared/crm-capabilities";
import { useCrmAcquisitionSources } from "../../../shared/hooks/useCrmAcquisitionSources";
import { useLeadCapabilities } from "../../hooks/useLeadCapabilities";
import type { LeadDetail } from "../../lead-contract";
import { formatLeadStageAge } from "../../lead-stage-age";
import type { LeadDetailCard } from "../lead-detail-card-contract";
import { useLeadCardEdit } from "./useLeadCardEdit";
import { useLeadCompanyEdit } from "./useLeadCompanyEdit";
import { useLeadConvert } from "./useLeadConvert";
import { useLeadDetail } from "./useLeadDetail";
import { useLeadStageMove } from "./useLeadStageMove";

/**
 * Everything `/crm/leads/[id]` decides before it draws.
 *
 * Every action is gated by the `capabilities` response, never by a permission
 * string (defect D11 / 8.5) — `crm.leads.update.own` says nothing about whether
 * *this* lead is one of the actor's own, and the capability's `ownerUserIds`
 * boundary does. Card-specific editors own their changed-field saves; there is
 * no page-wide editor.
 */
export function useLeadDetailWorkspace(leadId: string) {
  const { lang } = useI18n();
  const detail = useLeadDetail(leadId);
  const { lead, setLead, setCard, stageCatalogue } = detail;
  const { capabilities, error: capabilitiesError } = useLeadCapabilities(lead?.branchId ?? null);
  const sources = useCrmAcquisitionSources();
  const { canMutate } = useAccessMode();
  // Fixed at mount: a stage age is read at a glance, not watched tick by tick.
  const [now] = useState(() => Date.now());

  const companyEdit = useLeadCompanyEdit(lead, setLead, detail.reload);
  const canConvert = canMutate && lead !== null && lead.status !== "CONVERTED" &&
    !lead.convertedCustomerProfileId && crmCapabilityAllowsOwner(capabilities.convert, lead.ownerUserId);
  const convert = useLeadConvert(lead, detail.reload, canConvert, capabilities.opportunitiesCreate ?? null);
  const canUpdate =
    canMutate && lead !== null && crmCapabilityAllowsOwner(capabilities.update, lead.ownerUserId);
  // A converted lead answers every PATCH with 409 LEAD_ALREADY_CONVERTED.
  const canEditRecord = canUpdate && lead?.status !== "CONVERTED";
  const stageMove = useLeadStageMove(lead, detail.stages, canUpdate, detail.reload);
  const onCardSaved = useCallback((next: LeadDetail, card: LeadDetailCard) => {
    setLead(next);
    setCard(card);
  }, [setLead, setCard]);
  const cardEdit = useLeadCardEdit(lead, canEditRecord, onCardSaved, detail.reload);

  const stageLabels = useMemo(
    () => Object.fromEntries(stageCatalogue.map((stage) => [stage.id, localizedValue(stage.nameAr, stage.nameEn, lang)])),
    [stageCatalogue, lang],
  );
  const sourceLabel = lead ? localizedValue(lead.acquisitionSourceNameAr, lead.acquisitionSourceNameEn, lang) : "";
  const stageAge = formatLeadStageAge(detail.card?.stageEnteredAt, now, lang);

  return {
    detail,
    capabilities,
    capabilitiesError,
    sources,
    canMutate,
    canUpdate,
    canEditRecord,
    canConvert,
    companyEdit,
    convert,
    stageMove,
    cardEdit,
    stageLabels,
    sourceLabel,
    stageAge,
  };
}
