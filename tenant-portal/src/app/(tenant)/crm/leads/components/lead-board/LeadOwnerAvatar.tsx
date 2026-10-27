"use client";

import { Avatar, AvatarFallback } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { leadOwnerInitials, type LeadOwner } from "../../lead-card-contract";

interface LeadOwnerAvatarProps {
  owner: LeadOwner | null;
}

export function LeadOwnerAvatar({ owner }: LeadOwnerAvatarProps) {
  const { t } = useI18n();
  const initials = owner ? leadOwnerInitials(owner) : "";
  if (!owner || !initials) {
    return null;
  }

  const fullName = [owner.firstName.trim(), owner.lastName.trim()].filter(Boolean).join(" ");
  const ownerLabel = formatTemplate(t.crmLeads.card.owner, { name: fullName || initials });

  return (
    <Avatar
      tone="user"
      title={ownerLabel}
      aria-label={ownerLabel}
      className="size-[25px]"
    >
      <AvatarFallback>
        <span className="text-micro leading-none">{initials}</span>
      </AvatarFallback>
    </Avatar>
  );
}
