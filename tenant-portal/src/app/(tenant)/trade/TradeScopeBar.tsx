"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useTradeScope } from "./useTradeScope";

const CLEAR_VALUE = "__all__";

/**
 * The Trade operating-context selector — company, branch, channel.
 *
 * Company and branch render as ids because `/auth/me` is the only proven
 * source for which ones the actor may use and it carries no names; that is the
 * same choice `TenantBranchSelect` already makes across CRM. Channels carry a
 * real name, because `GET /channels` returns one.
 *
 * Branch and channel are clearable: most Trade reads are `OPERATING_CONTEXT`
 * or `COMPANY_OR_BRANCH`, where dropping the branch widens the scope to the
 * company rather than failing, and a channel is never required by any route on
 * the foundation pages.
 */
export function TradeScopeBar() {
  const { t } = useI18n();
  const {
    context,
    companyIds,
    branchIds,
    channels,
    isLoadingChannels,
    selectCompany,
    selectBranch,
    selectChannel,
  } = useTradeScope();

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.trade.scopeTitle}>
      <Select value={context.companyId ?? undefined} onValueChange={selectCompany}>
        <SelectTrigger size="sm" dir="ltr" aria-label={t.trade.scopeCompany} className="w-56 font-mono">
          <SelectValue placeholder={t.trade.scopeSelectCompany} />
        </SelectTrigger>
        <SelectContent>
          {companyIds.map((id) => (
            <SelectItem key={id} value={id}>
              {id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={context.branchId ?? CLEAR_VALUE}
        onValueChange={(next) => selectBranch(next === CLEAR_VALUE ? null : next)}
        disabled={branchIds.length === 0}
      >
        <SelectTrigger size="sm" dir="ltr" aria-label={t.trade.scopeBranch} className="w-56 font-mono">
          <SelectValue placeholder={t.trade.scopeAllBranches} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CLEAR_VALUE}>{t.trade.scopeAllBranches}</SelectItem>
          {branchIds.map((id) => (
            <SelectItem key={id} value={id}>
              {id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={context.channelId ?? CLEAR_VALUE}
        onValueChange={(next) => selectChannel(next === CLEAR_VALUE ? null : next)}
        disabled={isLoadingChannels || channels.length === 0}
      >
        <SelectTrigger size="sm" aria-label={t.trade.scopeChannel} className="w-56">
          <SelectValue placeholder={t.trade.scopeNoChannel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CLEAR_VALUE}>{t.trade.scopeNoChannel}</SelectItem>
          {channels.map((channel) => (
            <SelectItem key={channel.id} value={channel.id}>
              {channel.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
