"use client";

import { Phone } from "lucide-react";
import { Button, ContactChannelIcon, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { countryIsoFromName, getCountryOptions } from "@/lib/geo/country-data";
import { normalizePhoneDigits, normalizeWhatsAppDigits } from "../lead-phone-links";

/** One stored number with direct call, WhatsApp and Telegram actions. */
export function LeadPhoneActionsRow({
  phone,
  country,
  actionsOnly = false,
  showNumber = true,
  badge,
}: {
  phone: string;
  country?: string | null;
  actionsOnly?: boolean;
  showNumber?: boolean;
  badge?: string;
}) {
  const { t, lang } = useI18n();
  const countryIso = country
    ? (/^[A-Z]{2}$/u.test(country.trim().toUpperCase())
        ? country.trim().toUpperCase()
        : countryIsoFromName(country))
    : null;
  const countryOption = countryIso
    ? getCountryOptions(lang).find(({ isoCode }) => isoCode === countryIso)
    : undefined;
  const full = normalizePhoneDigits(phone);
  const digits = normalizeWhatsAppDigits(phone, country);
  const displayNumber = showNumber && !actionsOnly;
  const actions = [
    {
      channel: "call",
      href: full ? `tel:${full}` : "",
      label: t.crmLeadDetail.callAction,
      accessibleLabel: formatTemplate(t.crmLeadDetail.callNumber, { value: full }),
      className: "dossier-comm-call",
    },
    {
      channel: "whatsapp",
      href: digits ? `https://wa.me/${digits}` : "",
      label: t.crmLeadDetail.whatsappAction,
      accessibleLabel: formatTemplate(t.crmLeadDetail.whatsappNumber, { value: full }),
      className: "dossier-comm-wa",
    },
    {
      channel: "telegram",
      href: digits ? `https://t.me/+${digits}` : "",
      label: t.crmLeadDetail.telegramAction,
      accessibleLabel: formatTemplate(t.crmLeadDetail.telegramNumber, { value: full }),
      className: "dossier-comm-tg",
    },
  ] as const;

  return (
    <div
      className={cn(
        "flex min-w-0 items-center",
        displayNumber
          ? "dossier-phone-item-view flex-wrap justify-between gap-2"
          : "gap-0.5",
      )}
      onClick={(event) => event.stopPropagation()}
    >
      {displayNumber && (
        <div className="flex min-w-0 items-center gap-1.5">
          {countryOption?.flag ? (
            <span className="shrink-0 text-sm leading-none" aria-hidden="true">
              {countryOption.flag}
            </span>
          ) : (
            <Phone
              className={cn(iconSize({ size: "sm" }), "shrink-0 text-success-vivid")}
              aria-hidden="true"
            />
          )}
          <span className="dossier-phone-num min-w-0 truncate" dir="ltr" title={full}>
            {full || "—"}
          </span>
          {badge && <span className="dossier-phone-tag shrink-0">{badge}</span>}
        </div>
      )}
      <div className={cn("flex items-center", actionsOnly ? "gap-0.5" : "dossier-ch-group flex-wrap gap-1.5")}>
        {actions.filter(({ href }) => href).map((action) => (
          <Button
            key={action.channel}
            variant="ghost"
            size="xs"
            className={actionsOnly
              ? "w-(--size-control-xs) shrink-0 px-1"
              : cn("dossier-comm-btn gap-1.5", action.className)}
            asChild
          >
            <a
              href={action.href}
              target={action.channel === "call" ? undefined : "_blank"}
              rel={action.channel === "call" ? undefined : "noopener noreferrer"}
              aria-label={action.accessibleLabel}
              title={action.label}
            >
              <ContactChannelIcon channel={action.channel} />
              {!actionsOnly && <span>{action.label}</span>}
            </a>
          </Button>
        ))}
      </div>
    </div>
  );
}
