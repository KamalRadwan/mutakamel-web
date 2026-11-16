"use client";

import Link from "next/link";
import { ArrowUpRight, MoreHorizontal, Plus } from "lucide-react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip, TooltipContent, TooltipTrigger, cn, hitArea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { QuotationComposerState } from "../hooks/useQuotationComposer";
import { QuotationShareButtons } from "./QuotationShareButtons";
import { QuotationBackAction } from "./QuotationBackAction";

export type QuotationWorkspaceActionState = Pick<QuotationComposerState,
  "savedQuotation" | "isDetailsCurrent" | "savingStep" | "resetComposer" | "hasPopulatedLines"
  | "canSubmitHeaderOnly" | "partialHeaderConflict" | "isReloadingDetails" | "submit">
  & { write: Pick<QuotationComposerState["write"], "isBlocked"> };

/** Keep the primary PageHeader action in view while retaining every secondary action. */
export function QuotationWorkspaceActions({ composer }: { composer: QuotationWorkspaceActionState }) {
  const { t, dir } = useI18n();
  const copy = t.quotationExperience;
  const qCopy = t.tradeDocuments.quotations;
  const saved = composer.savedQuotation;
  const resetDisabled = composer.write.isBlocked || composer.savingStep !== "idle";
  const headerDisabled = !composer.canSubmitHeaderOnly || composer.partialHeaderConflict || composer.isReloadingDetails;
  return <div className="flex shrink-0 items-center gap-2" data-testid="quotation-workspace-actions">
    <QuotationBackAction />
    {saved && composer.isDetailsCurrent ? <QuotationShareButtons quotation={saved} className="hidden md:inline-flex" /> : null}
    <div className="hidden items-center gap-2 md:flex" data-testid="quotation-desktop-actions">
      {saved ? <>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={resetDisabled} onClick={composer.resetComposer}><Plus className="size-3.5" aria-hidden="true" />{copy.createAnother}</Button>
        <Button variant="outline" size="sm" asChild className="gap-1.5"><Link href={`${TENANT_ROUTES.tradeQuotations}/${saved.id}`}><ArrowUpRight className="size-3.5" aria-hidden="true" />{copy.openSaved}</Link></Button>
      </> : composer.hasPopulatedLines ? <Button variant="ghost" size="sm" disabled={headerDisabled} onClick={() => void composer.submit({ headerOnly: true })}>{qCopy.saveHeaderOnly}</Button> : null}
    </div>
    {saved || composer.hasPopulatedLines ? <div className="md:hidden">
      <DropdownMenu dir={dir}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="md" className={cn("w-8 px-0", hitArea)} aria-label={t.common.actions}>
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t.common.actions}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          {saved ? <>
            <DropdownMenuItem disabled={resetDisabled} onSelect={composer.resetComposer}><Plus className="size-4" aria-hidden="true" />{copy.createAnother}</DropdownMenuItem>
            <DropdownMenuItem asChild><Link href={`${TENANT_ROUTES.tradeQuotations}/${saved.id}`}><ArrowUpRight className="size-4" aria-hidden="true" />{copy.openSaved}</Link></DropdownMenuItem>
          </> : composer.hasPopulatedLines ? <DropdownMenuItem disabled={headerDisabled} onSelect={() => void composer.submit({ headerOnly: true })}>{qCopy.saveHeaderOnly}</DropdownMenuItem> : null}
          {saved && composer.isDetailsCurrent ? <><DropdownMenuSeparator /><QuotationShareButtons quotation={saved} presentation="menu" /></> : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div> : null}
  </div>;
}
