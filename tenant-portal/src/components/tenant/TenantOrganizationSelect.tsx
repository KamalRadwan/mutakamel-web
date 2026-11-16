"use client";

import { NameSelect } from "@/design-system";
import { useTenantOrganizationOptions } from "@/hooks/useTenantOrganizationOptions";

export function TenantOrganizationSelect({ kind, ids, allOption, ...props }: {
  kind: "company" | "branch";
  ids: readonly string[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  allOption?: { value: string; label: string };
}) {
  const options = useTenantOrganizationOptions(kind, ids);
  return <NameSelect {...props} options={allOption ? [allOption, ...options] : options} />;
}
