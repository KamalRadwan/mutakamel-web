"use client";

import { Building2, Check, ExternalLink, Loader2, Sparkles, UserRound } from "lucide-react";
import { Button, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { CrmRatingStars } from "../../../shared/components/board/CrmRatingStars";
import type { CustomerBoardQuickAddProps } from "./customer-board-types";
import { CustomerBoardQuickAddCompany } from "./CustomerBoardQuickAddCompany";
import { CustomerBoardQuickAddIndividual } from "./CustomerBoardQuickAddIndividual";
import { useCustomerBoardQuickAdd } from "./useCustomerBoardQuickAdd";

export function CustomerBoardQuickAddCard(props: CustomerBoardQuickAddProps) {
  const { t } = useI18n();
  const form = useCustomerBoardQuickAdd(props);
  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-line-card bg-card p-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-caption font-semibold text-foreground-secondary">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {formatTemplate(t.crmCustomerProfiles.ui.board.quick_add_in_status_2, { statusTitle: props.statusTitle })}
        </span>
        <Button type="button" variant="ghost" size="xs" onClick={form.handleOpenFullModal}
          className="inline-flex h-auto gap-0.5 p-0 text-caption text-primary">
          {t.crmCustomerProfiles.ui.board.full_modal}<ExternalLink className="size-3" aria-hidden="true" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-subtle p-1">
        <Button type="button" variant="ghost" size="xs" aria-pressed={form.profileType === "INDIVIDUAL"}
          onClick={() => { form.changeProfileType("INDIVIDUAL"); }}
          className={cn("gap-1 rounded-md text-caption", form.profileType === "INDIVIDUAL" && "bg-card text-primary shadow-2xs")}>
          <UserRound className="size-3.5" aria-hidden="true" />{t.crmCustomerProfiles.ui.board.individual}
        </Button>
        <Button type="button" variant="ghost" size="xs" aria-pressed={form.profileType === "CORPORATE"}
          onClick={() => { form.changeProfileType("CORPORATE"); }}
          className={cn("gap-1 rounded-md text-caption", form.profileType === "CORPORATE" && "bg-card text-primary shadow-2xs")}>
          <Building2 className="size-3.5" aria-hidden="true" />{t.crmCustomerProfiles.ui.board.company}
        </Button>
      </div>
      {form.profileType === "INDIVIDUAL" ? <CustomerBoardQuickAddIndividual sources={props.sources} form={form} />
        : <CustomerBoardQuickAddCompany sources={props.sources} form={form} />}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <CrmRatingStars value={form.rating} onChange={form.setRating} ariaLabel={t.crmLeads.card.rating}
          starLabel={(count) => formatTemplate(t.crmLeads.card.rateStars, { count: String(count), max: "3" })} />
        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          <Button type="button" variant="outline" size="xs" disabled={form.isSubmitting} onClick={props.onCancel}>
            {t.crmCustomerProfiles.ui.board.cancel}
          </Button>
          <Button type="button" variant="outline" size="xs" disabled={form.isSubmitting}
            onClick={() => void form.handleQuickSave()} className="gap-1">
            {form.isSubmitting ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
            {t.crmCustomerProfiles.ui.board.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
