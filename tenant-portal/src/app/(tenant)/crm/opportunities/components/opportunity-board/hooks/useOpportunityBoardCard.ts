import { useEffect, useState, type DragEvent } from "react";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useTenantAuth } from "@/context/AuthContext";
import { canCreateActivities } from "@/components/activities/activity-presentation";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { countryIsoFromName, getCountryOptions } from "@/lib/geo/country-data";
import { opportunityPath, parseOpportunityDetailResponse, type OpportunityDetail } from "../../../opportunity-contract";
import type { OpportunityBoardCardProps } from "../opportunity-board-types";

export function useOpportunityBoardCard(props: OpportunityBoardCardProps) {
  const { t, lang } = useI18n();
  const { canMutate } = useAccessMode();
  const { user } = useTenantAuth();
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isDetailForbidden, setIsDetailForbidden] = useState(false);

  useEffect(() => {
    if (!props.isExpanded) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setIsLoadingDetail(true);
        setIsDetailForbidden(false);
      }
    });
    axiosClient.get<unknown>(opportunityPath(props.item.id), { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!controller.signal.aborted) setDetail(parseOpportunityDetailResponse(response.data));
      })
      .catch((error: unknown) => {
        // Network failures retain the board projection; an authoritative denial has its own boundary.
        if (!controller.signal.aborted && normalizeApiError(error).status === 403) setIsDetailForbidden(true);
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoadingDetail(false); });
    return () => controller.abort();
  }, [props.isExpanded, props.item.id]);

  const effective = detail?.id === props.item.id ? detail : props.item;
  const corporate = effective.customerProfileType === "CORPORATE";
  const customerName = (corporate ? effective.customerCompanyName : null) ?? effective.customerDisplayName ?? t.crmOpportunities.notProvided;
  const storedCountry = effective.customerCountry?.trim() ?? "";
  const countryIso = /^[A-Z]{2}$/u.test(storedCountry.toUpperCase()) ? storedCountry.toUpperCase() : countryIsoFromName(storedCountry);
  const country = getCountryOptions(lang).find(({ isoCode }) => isoCode === countryIso);

  function startDrag(event: DragEvent) {
    if (!props.canDrag) { event.preventDefault(); return; }
    event.dataTransfer.effectAllowed = "move";
    try { event.dataTransfer.setData("text/plain", props.item.id); } catch {
      // Some browsers deny dataTransfer writes; the in-memory drag record still identifies the card.
    }
    props.onDragStart();
  }

  return {
    effective, corporate, customerName, country, isLoadingDetail, isDetailForbidden,
    primaryPhone: effective.primaryContact?.phones[0] ?? effective.customerPhone ?? null,
    primaryEmail: effective.primaryContact?.email ?? effective.customerEmail ?? null,
    location: [effective.customerCity, country?.name ?? effective.customerCountry].filter(Boolean).join(", "),
    canOpenActivities: canMutate && canCreateActivities(user),
    startDrag,
  };
}
