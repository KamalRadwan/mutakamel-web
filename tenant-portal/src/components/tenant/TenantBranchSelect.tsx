"use client";

import { Select } from "@/components/ui/Select";
import { useI18n } from "@/i18n/I18nContext";

interface TenantBranchSelectProps {
  branchIds: readonly string[];
  branchId: string | null;
  onChange: (branchId: string) => void;
  disabled?: boolean;
}

export function TenantBranchSelect({
  branchIds,
  branchId,
  onChange,
  disabled = false,
}: TenantBranchSelectProps) {
  const { lang } = useI18n();
  if (branchIds.length < 2) return null;
  const label = lang === "ar" ? "الفرع" : "Branch";
  const select = lang === "ar" ? "اختر فرعًا" : "Select a branch";

  return (
    <div className="w-72 max-w-full">
      <Select
        aria-label={label}
        value={branchId ?? ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="font-mono"
        options={[
          { label: select, value: "" },
          ...branchIds.map((id) => ({ label: id, value: id })),
        ]}
      />
    </div>
  );
}
