"use client";

import { Globe, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Badge, Button, CopyButton, TagChip, toTagColor } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { countryIsoFromName } from "@/lib/geo/country-data";
import { CrmPhoneActionsRow } from "../../../shared/components/CrmPhoneActionsRow";
import { safeWebsiteHref } from "../../../shared/safe-website-href";
import type {
  CustomerProfileItem,
  CustomerProfileStatus,
} from "./customer-grid-types";

function customerCountryIso(country: string | null | undefined): string | null {
  const trimmed = country?.trim() ?? "";
  if (!trimmed) return null;
  if (/^[A-Z]{2}$/iu.test(trimmed)) return trimmed.toUpperCase();
  return countryIsoFromName(trimmed);
}

function statusBadgeTone(
  status: CustomerProfileStatus,
): "positive" | "negative" | "neutral" {
  if (status === "ACTIVE_CUSTOMER") return "positive";
  if (status === "BLACKLISTED") return "negative";
  return "neutral";
}

interface CustomerGridCardBodyProps {
  item: CustomerProfileItem;
  canEdit: boolean;
  onOpenQuickModal?: () => void;
}

export function CustomerGridCardBody({
  item,
  canEdit,
  onOpenQuickModal,
}: CustomerGridCardBodyProps) {
  const { t, lang } = useI18n();
  const cardDict = t.crmLeads.card;
  const statusLabels: Record<string, string | undefined> = t.statusValues;

  const isCorporate = item.profileType === "CORPORATE";
  const contactName = isCorporate
    ? item.primaryContact?.displayName.trim() || item.primaryContactName?.trim() || ""
    : "";
  const contactRole = isCorporate ? (item.primaryContact?.jobTitle.trim() ?? "") : "";

  const countryIso = customerCountryIso(item.country);
  const rawCountry = item.country.trim();
  const countryDisplay =
    rawCountry && rawCountry.toUpperCase() !== countryIso ? rawCountry : "";
  const locationText = [countryDisplay, item.city.trim()].filter(Boolean).join(" · ");
  const hasLocation = Boolean(countryIso || locationText);

  const primaryPhone = (
    (isCorporate ? item.primaryContact?.phones[0] || item.phone : item.phone) ||
    item.phones[0] ||
    ""
  ).trim();
  const primaryEmail = (
    (isCorporate ? item.primaryContact?.email || item.email : item.email) || ""
  ).trim();
  const website = item.companyWebsite?.trim() ?? "";
  const websiteHref = safeWebsiteHref(website);

  const statusLabel = (statusLabels[`CustomerStatus.${item.status}`] ?? item.status).trim();
  const sourceLabel = localizedValue(
    item.acquisitionSourceNameAr,
    item.acquisitionSourceNameEn,
    lang,
  ).trim();
  const visibleTags = item.tags.slice(0, 2);
  const overflowCount = Math.max(0, item.tags.length - visibleTags.length);
  const showSourceBadge = sourceLabel.length > 0;
  const hasMetaRow = statusLabel.length > 0 || showSourceBadge || visibleTags.length > 0;

  return (
    <div className="flex flex-col gap-2">
      {hasLocation && (
        <div className="flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
          <MapPin className="size-3 shrink-0" aria-hidden="true" />
          <p className="min-w-0 truncate">
            {countryIso && (
              <span className="font-semibold text-foreground-secondary">{`${countryIso} `}</span>
            )}
            {locationText && <bdi>{locationText}</bdi>}
          </p>
        </div>
      )}

      <div
        className="flex flex-col gap-1.5 rounded-md border border-line-divider bg-surface-subtle px-2.5 py-2"
        onClick={(event) => event.stopPropagation()}
      >
        {contactName && (
          <div className="flex min-w-0 items-center justify-between gap-1.5">
            <span className="flex min-w-0 items-center gap-1.5 text-caption text-foreground-secondary">
              <UserRound className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate font-semibold text-foreground">
                <bdi>{contactName}</bdi>
                {contactRole ? (
                  <span className="font-normal text-muted-foreground">{` • ${contactRole}`}</span>
                ) : null}
              </span>
            </span>
            <Badge size="sm" tone="neutral" className="shrink-0">
              {cardDict.primary}
            </Badge>
          </div>
        )}

        <div className="flex min-w-0 items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <Phone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {primaryPhone ? (
              <span
                dir="ltr"
                className="min-w-0 truncate font-mono text-caption font-semibold tabular-nums text-foreground"
              >
                {primaryPhone}
              </span>
            ) : canEdit && onOpenQuickModal ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onOpenQuickModal}
                className="h-6 px-1 text-caption font-medium text-primary"
              >
                {t.crmLeads.executive.addPhoneNumber}
              </Button>
            ) : (
              <span className="truncate text-caption text-muted-foreground">
                {t.crmCustomerProfiles.unavailable}
              </span>
            )}
          </div>

          {primaryPhone && (
            <CrmPhoneActionsRow phone={primaryPhone} country={item.country} actionsOnly />
          )}
        </div>

        <div className="flex min-w-0 items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {primaryEmail ? (
              <a
                href={`mailto:${primaryEmail}`}
                dir="ltr"
                aria-label={formatTemplate(cardDict.emailAction, { value: primaryEmail })}
                className="min-w-0 truncate text-caption font-medium text-foreground-secondary hover:text-primary hover:underline"
              >
                {primaryEmail}
              </a>
            ) : (
              <span className="truncate text-caption text-muted-foreground">
                {t.crmLeads.executive.noEmail}
              </span>
            )}
          </div>

          {primaryEmail && (
            <CopyButton
              value={primaryEmail}
              copyLabel={`${t.crmLeads.executive.copy}: ${primaryEmail}`}
              copiedLabel={t.crmLeads.executive.copied}
              failedLabel={t.crmCustomerProfiles.unavailable}
              size="xs"
              className="shrink-0"
            />
          )}
        </div>

        {website && (
          <div className="flex min-w-0 items-center gap-1.5">
            <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {websiteHref ? (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="min-w-0 truncate text-caption font-medium text-foreground-secondary hover:text-primary hover:underline"
              >
                {website.replace(/^https?:\/\//i, "")}
              </a>
            ) : (
              <span dir="ltr" className="min-w-0 truncate text-caption font-medium text-foreground-secondary">
                {website}
              </span>
            )}
          </div>
        )}
      </div>

      {hasMetaRow && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {statusLabel.length > 0 && (
            <Badge size="sm" tone={statusBadgeTone(item.status)} className="max-w-32">
              <bdi className="truncate">{statusLabel}</bdi>
            </Badge>
          )}

          {showSourceBadge && (
            <Badge size="sm" tone="positive" className="max-w-36">
              <bdi className="truncate">{sourceLabel}</bdi>
            </Badge>
          )}

          {visibleTags.map((tag, index) => {
            const customTagColor = toTagColor(tag.backgroundColor, tag.textColor);
            if (customTagColor) {
              return (
                <TagChip
                  key={tag.id}
                  size="compact"
                  label={tag.name}
                  backgroundColor={tag.backgroundColor}
                  textColor={tag.textColor}
                  className="max-w-28 font-semibold"
                />
              );
            }
            const defaultTone = !showSourceBadge && index === 0 ? "positive" : "neutral";
            return (
              <Badge key={tag.id} size="compact" tone={defaultTone} className="max-w-28">
                <bdi className="truncate">{tag.name}</bdi>
              </Badge>
            );
          })}

          {overflowCount > 0 && (
            <Badge size="compact" tone="neutral" className="shrink-0">
              {formatTemplate(cardDict.moreTags, { count: formatNumber(overflowCount, lang) })}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
