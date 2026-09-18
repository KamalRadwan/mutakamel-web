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

function phoneForms(phone: string, fallbackCallingCode = "") {
  const parsed = splitPhoneNumber(phone);
  if (!parsed) return { full: phone, digits: "" };
  const resolvedCallingCode = parsed.callingCode || fallbackCallingCode;
  const nationalNumber =
    parsed.callingCode || !resolvedCallingCode
      ? parsed.nationalNumber
      : parsed.nationalNumber.replace(/^0+/u, "");
  return {
    full: `${parsed.callingCode}${parsed.nationalNumber}`,
    digits: `${resolvedCallingCode.replace("+", "")}${nationalNumber}`,
  };
}

export function CustomerPhoneActionsRow({
  phone,
  country,
  actionsOnly = false,
}: {
  phone: string;
  country?: string;
  actionsOnly?: boolean;
}) {
  const { t, lang } = useI18n();
  const normalizedCountry = country?.trim() ?? "";
  const countryIso = normalizedCountry
    ? /^[A-Z]{2}$/u.test(normalizedCountry.toUpperCase())
      ? normalizedCountry.toUpperCase()
      : countryIsoFromName(normalizedCountry)
    : null;
  const fallbackCallingCode = countryIso
    ? getCountryOptions(lang).find(({ isoCode }) => isoCode === countryIso)
        ?.callingCode
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
            className={cn(
              iconSize({ size: "sm" }),
              "me-1 shrink-0 text-muted-foreground",
            )}
            aria-hidden="true"
          />
          <span
            className="min-w-0 flex-1 truncate text-xs text-foreground"
            dir="ltr"
            title={full}
          >
            {full}
          </span>
        </>
      )}
      <Button
        variant="ghost"
        size="xs"
        className="w-(--size-control-xs) shrink-0 px-1"
        asChild
      >
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
          <Button
            variant="ghost"
            size="xs"
            className="w-(--size-control-xs) shrink-0 px-1"
            asChild
          >
            <a
              href={`https://wa.me/${digits}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={formatTemplate(t.crmLeadDetail.whatsappNumber, {
                value: full,
              })}
              title={t.crmLeadDetail.whatsappAction}
            >
              <ContactChannelIcon channel="whatsapp" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className="w-(--size-control-xs) shrink-0 px-1"
            asChild
          >
            <a
              href={`https://t.me/+${digits}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={formatTemplate(t.crmLeadDetail.telegramNumber, {
                value: full,
              })}
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
