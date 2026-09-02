"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

interface TenantBranchSelectProps {
  branchIds: readonly string[];
  branchId: string | null;
  onChange: (branchId: string) => void;
  disabled?: boolean;
}

// Every CRM read is branch-scoped — one of these per workspace. Hidden when
// the account only has one accessible branch, since there is nothing to
// choose. See docs/design/views.md#shared-behavior--identical-across-all-three-views.
export function TenantBranchSelect({ branchIds, branchId, onChange, disabled = false }: TenantBranchSelectProps) {
  const { t } = useI18n();
  if (branchIds.length < 2) return null;

  return (
    <Select value={branchId ?? undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger size="sm" dir="ltr" aria-label={t.common.branch} className="w-56 font-mono">
        <SelectValue placeholder={t.common.selectBranch} />
      </SelectTrigger>
      <SelectContent>
        {branchIds.map((id) => (
          <SelectItem key={id} value={id}>
            {id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
