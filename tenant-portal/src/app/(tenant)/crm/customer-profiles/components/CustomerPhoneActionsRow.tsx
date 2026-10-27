"use client";

import { Phone } from "lucide-react";
import { Button, ContactChannelIcon, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  normalizePhoneDigits,
  normalizeWhatsAppDigits,
} from "../../leads/lead-phone-links";
import {
  countryIsoFromName,
  getCountryOptions,
} from "@/lib/geo/country-data";

export function CustomerPhoneActionsRow({
  phone,
  country,
  actionsOnly = false,
  badge,
}: {
  phone: string;
  country?: string;
  actionsOnly?: boolean;
  badge?: string;
}) {
  const { t, lang } = useI18n();
  const normalizedCountry = country?.trim() ?? "";
  const countryIso = normalizedCountry
    ? /^[A-Z]{2}$/u.test(normalizedCountry.toUpperCase())
      ? normalizedCountry.toUpperCase()
      : countryIsoFromName(normalizedCountry)
    : null;
  const countryOption = countryIso
    ? getCountryOptions(lang).find(({ isoCode }) => isoCode === countryIso)
    : undefined;
  const full = normalizePhoneDigits(phone);
  const digits = normalizeWhatsAppDigits(phone, country);

  if (actionsOnly) {
    return (
      <div
        className="flex min-w-0 items-center gap-0.5"
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="xs"
          className="w-(--size-control-xs) shrink-0 px-1"
          asChild
        >
          <a
            href={`tel:${full}`}
            aria-label={formatTemplate(t.crmLeadDetail.callNumber, {
              value: full,
            })}
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

  return (
    <div
      className="dossier-phone-item-view flex min-w-0 flex-wrap items-center justify-between gap-2"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {countryOption?.flag ? (
          <span className="shrink-0 text-sm leading-none" aria-hidden="true">
            {countryOption.flag}
          </span>
        ) : (
          <Phone
            className={cn(
              iconSize({ size: "sm" }),
              "shrink-0 text-success",
            )}
            aria-hidden="true"
          />
        )}
        <span
          className="dossier-phone-num min-w-0 truncate"
          dir="ltr"
          title={full}
        >
          {full}
        </span>
        {badge && <span className="dossier-phone-tag shrink-0">{badge}</span>}
      </div>
      <div className="dossier-ch-group flex flex-wrap items-center gap-1.5">
        <a
          href={`tel:${full}`}
          aria-label={formatTemplate(t.crmLeadDetail.callNumber, {
            value: full,
          })}
          title={t.crmLeadDetail.callAction}
          className="dossier-comm-btn dossier-comm-call"
        >
          <ContactChannelIcon channel="call" />
          <span>{t.crmLeadDetail.callAction}</span>
        </a>
        {digits && (
          <>
            <a
              href={`https://wa.me/${digits}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={formatTemplate(t.crmLeadDetail.whatsappNumber, {
                value: full,
              })}
              title={t.crmLeadDetail.whatsappAction}
              className="dossier-comm-btn dossier-comm-wa"
            >
              <ContactChannelIcon channel="whatsapp" />
              <span>{t.crmLeadDetail.whatsappAction}</span>
            </a>
            <a
              href={`https://t.me/+${digits}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={formatTemplate(t.crmLeadDetail.telegramNumber, {
                value: full,
              })}
              title={t.crmLeadDetail.telegramAction}
              className="dossier-comm-btn dossier-comm-tg"
            >
              <ContactChannelIcon channel="telegram" />
              <span>{t.crmLeadDetail.telegramAction}</span>
            </a>
          </>
        )}
      </div>
    </div>
  );
}

