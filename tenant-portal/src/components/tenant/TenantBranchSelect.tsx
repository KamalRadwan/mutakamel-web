"use client";

import { cn, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

// Radix Select has no empty value, so "every branch" rides on a sentinel.
const ALL_BRANCHES = "__all__";

type TenantBranchSelectProps = {
  branchIds: readonly string[];
  branchId: string | null;
  disabled?: boolean;
} & (
  | { allowAll?: false; onChange: (branchId: string) => void }
  | {
      /** Offers "all accessible branches" first; choosing it reports `null`. */
      allowAll: true;
      onChange: (branchId: string | null) => void;
    }
);

// Every CRM read is branch-scoped — one of these per workspace. Hidden when
// the account only has one accessible branch, since there is nothing to
// choose. See docs/design/views.md#shared-behavior--identical-across-all-three-views.
export function TenantBranchSelect(props: TenantBranchSelectProps) {
  const { branchIds, branchId, disabled = false } = props;
  const { t } = useI18n();
  if (branchIds.length < 2) return null;

  // "All branches" is a sentence, not an id: it reads in the viewer's language and direction.
  const showsAll = props.allowAll === true && branchId === null;

  function change(next: string) {
    if (props.allowAll) props.onChange(next === ALL_BRANCHES ? null : next);
    else props.onChange(next);
  }

  return (
    <Select value={showsAll ? ALL_BRANCHES : (branchId ?? undefined)} onValueChange={change} disabled={disabled}>
      <SelectTrigger
        size="sm"
        dir={showsAll ? undefined : "ltr"}
        aria-label={t.common.branch}
        className={cn("w-56", !showsAll && "font-mono")}
      >
        <SelectValue placeholder={t.common.selectBranch} />
      </SelectTrigger>
      <SelectContent>
        {props.allowAll && <SelectItem value={ALL_BRANCHES}>{t.common.allBranches}</SelectItem>}
        {branchIds.map((id) => (
          <SelectItem key={id} value={id}>
            {id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
