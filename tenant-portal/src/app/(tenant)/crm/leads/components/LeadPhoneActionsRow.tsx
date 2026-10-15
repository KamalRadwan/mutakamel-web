"use client";

import { Phone } from "lucide-react";
import { Button, ContactChannelIcon, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  countryIsoFromName,
  getCountryOptions,
  splitPhoneNumber,
} from "@/lib/geo/country-data";

function phoneForms(phone: string, fallbackCallingCode = ""): {
  full: string;
  digits: string;
} {
  const parsed = splitPhoneNumber(phone);
  if (!parsed) return { full: phone, digits: "" };
  const { callingCode, nationalNumber } = parsed;
  const resolvedCallingCode = callingCode || fallbackCallingCode;
  const full = `${callingCode}${nationalNumber}`;
  // WhatsApp and Telegram address an international number. A local number with
  // no country to supply its calling code has none, so it gets no chat links.
  if (!resolvedCallingCode) return { full, digits: "" };
  const normalizedNationalNumber = callingCode
    ? nationalNumber
    : nationalNumber.replace(/^0+/u, "");
  return {
    full,
    digits: `${resolvedCallingCode.replace("+", "")}${normalizedNationalNumber}`,
  };
}

/** One stored number with direct call, WhatsApp and Telegram actions. */
export function LeadPhoneActionsRow({
  phone,
  country,
  actionsOnly = false,
}: {
  phone: string;
  country?: string;
  actionsOnly?: boolean;
}) {
  const { t, lang } = useI18n();
  const countryIso = country
    ? (/^[A-Z]{2}$/u.test(country.trim().toUpperCase())
        ? country.trim().toUpperCase()
        : countryIsoFromName(country))
    : null;
  const fallbackCallingCode = countryIso
    ? getCountryOptions(lang).find(({ isoCode }) => isoCode === countryIso)?.callingCode
    : undefined;
  const { full, digits } = phoneForms(phone, fallbackCallingCode);

  return (
    <div
      className="flex min-w-0 items-center gap-0.5"
      onClick={(event) => event.stopPropagation()}
    >
      {!actionsOnly && (
        <>
          <Phone
            className={cn(iconSize({ size: "sm" }), "me-1 shrink-0 text-muted-foreground")}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-xs text-foreground" dir="ltr" title={full}>
            {full}
          </span>
        </>
      )}
      <Button variant="ghost" size="xs" className="w-(--size-control-xs) shrink-0 px-1" asChild>
        <a
          href={`tel:${full}`}
          aria-label={formatTemplate(t.crmLeadDetail.callNumber, { value: full })}
          title={t.crmLeadDetail.callAction}
        >
          <ContactChannelIcon channel="call" />
        </a>
      </Button>
      {digits && (
        <>
          <Button variant="ghost" size="xs" className="w-(--size-control-xs) shrink-0 px-1" asChild>
            <a
              href={`https://wa.me/${digits}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={formatTemplate(t.crmLeadDetail.whatsappNumber, { value: full })}
              title={t.crmLeadDetail.whatsappAction}
            >
              <ContactChannelIcon channel="whatsapp" />
            </a>
          </Button>
          <Button variant="ghost" size="xs" className="w-(--size-control-xs) shrink-0 px-1" asChild>
            <a
              href={`https://t.me/+${digits}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={formatTemplate(t.crmLeadDetail.telegramNumber, { value: full })}
              title={t.crmLeadDetail.telegramAction}
            >
              <ContactChannelIcon channel="telegram" />
            </a>
          </Button>
        </>
      )}
    </div>
  );
}
