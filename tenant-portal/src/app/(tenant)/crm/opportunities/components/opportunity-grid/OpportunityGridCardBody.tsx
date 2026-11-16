"use client";

import {
  Banknote,
  Building2,
  Calendar,
  CirclePercent,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import {
  Badge,
  CopyButton,
  DateTime,
  Money,
  StatusBadge,
  TagChip,
  cn,
  toTagColor,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { countryIsoFromName } from "@/lib/geo/country-data";
import { AcquisitionSourceIcon } from "../../../shared/components/AcquisitionSourceIcon";
import { CrmPhoneActionsRow } from "../../../shared/components/CrmPhoneActionsRow";
import type { OpportunityListItem } from "../../hooks/useOpportunitiesList";
import { opportunityProbabilityClass } from "../opportunity-card/opportunity-card-presentation";

function resolveCountryIso(country: string | null): string {
  const trimmed = (country ?? "").trim();
  if (!trimmed) return "";
  if (/^[A-Z]{2}$/iu.test(trimmed)) return trimmed.toUpperCase();
  return countryIsoFromName(trimmed) ?? "";
}

interface OpportunityGridCardBodyProps {
  item: OpportunityListItem;
}

export function OpportunityGridCardBody({
  item,
}: OpportunityGridCardBodyProps) {
  const { t, lang } = useI18n();
  const cardDict = t.crmLeads.card;
  const isCorporate = item.customerProfileType === "CORPORATE";
  const customerName =
    (isCorporate ? item.customerCompanyName : null) ??
    item.customerDisplayName ??
    t.crmOpportunities.notProvided;

  const countryIso = resolveCountryIso(item.customerCountry);
  const rawCountry = (item.customerCountry ?? "").trim();
  const countryDisplay =
    rawCountry && rawCountry.toUpperCase() !== countryIso ? rawCountry : "";
  const locationText = [countryDisplay, (item.customerCity ?? "").trim()]
    .filter(Boolean)
    .join(" · ");

  const contactDisplayName =
    item.primaryContact?.displayName || customerName;
  const contactRole = item.primaryContact?.jobTitle?.trim() ?? "";
  const primaryPhone = (
    item.primaryContact?.phones[0] ??
    item.customerPhone ??
    ""
  ).trim();
  const primaryEmail = (
    item.primaryContact?.email ??
    item.customerEmail ??
    ""
  ).trim();

  const probabilityLabel =
    item.probabilityPercent === null
      ? null
      : formatTemplate(t.crmOpportunityDetail.probabilityValue, {
          percent: formatNumber(item.probabilityPercent, lang),
        });

  const visibleTags = item.tags.slice(0, 3);
  const overflowCount = Math.max(0, item.tags.length - visibleTags.length);

  return (
    <div className="flex flex-col gap-2">
      {/* Customer & Location Line */}
      <div className="flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
        <MapPin className="size-3 shrink-0" aria-hidden="true" />
        <p className="min-w-0 truncate">
          {countryIso && (
            <span className="font-semibold text-foreground-secondary">
              {`${countryIso} `}
            </span>
          )}
          <bdi className="font-medium text-foreground-secondary">
            {customerName}
          </bdi>
          {locationText && (
            <>
              <span aria-hidden="true">{" · "}</span>
              <bdi>{locationText}</bdi>
            </>
          )}
        </p>
      </div>

      {/* Deal Commercials Box */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-card bg-surface-subtle px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Banknote
            className="size-4 shrink-0 text-success"
            aria-hidden="true"
          />
          {item.amount ? (
            <Money
              value={item.amount}
              currency={item.currencyCode ?? undefined}
              language={lang}
              className="text-sm font-bold text-success"
            />
          ) : (
            <span className="text-caption font-medium text-muted-foreground">
              {t.crmOpportunities.notProvided}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {item.probabilityPercent !== null && (
            <span className={cn("inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-badge font-semibold tabular-nums", opportunityProbabilityClass(item.probabilityPercent))}>
              <CirclePercent className="size-3 shrink-0" aria-hidden="true" />
              {probabilityLabel}
            </span>
          )}
          {item.expectedCloseDate && (
            <span className="inline-flex items-center gap-1 text-badge font-medium tabular-nums text-muted-foreground">
              <Calendar className="size-3 shrink-0" aria-hidden="true" />
              <DateTime
                value={`${item.expectedCloseDate.slice(0, 10)}T00:00:00.000Z`}
                precision="date"
                language={lang}
                timeZone="UTC"
              />
            </span>
          )}
        </div>
      </div>

      {/* Primary Contact, Compact Phone Actions & Email */}
      <div
        className="flex flex-col gap-1.5 rounded-md border border-line-divider bg-surface-subtle px-2.5 py-2"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 items-center justify-between gap-1.5">
          <span className="flex min-w-0 items-center gap-1.5 text-caption text-foreground-secondary">
            <UserRound
              className="size-3 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="truncate font-semibold text-foreground">
              <bdi>{contactDisplayName}</bdi>
              {contactRole ? (
                <span className="font-normal text-muted-foreground">
                  {` • ${contactRole}`}
                </span>
              ) : null}
            </span>
          </span>
          {item.primaryContact?.isPrimary && (
            <Badge size="sm" tone="neutral" className="shrink-0">
              {cardDict.primary}
            </Badge>
          )}
        </div>

        {primaryPhone ? (
          <CrmPhoneActionsRow
            phone={primaryPhone}
            country={item.customerCountry}
            compact
          />
        ) : (
          <div className="flex min-w-0 items-center gap-1.5">
            <Phone
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="truncate text-caption text-muted-foreground">
              {t.crmOpportunities.notProvided}
            </span>
          </div>
        )}

        <div className="flex min-w-0 items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <Mail
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            {primaryEmail ? (
              <a
                href={`mailto:${primaryEmail}`}
                dir="ltr"
                aria-label={formatTemplate(cardDict.emailAction, {
                  value: primaryEmail,
                })}
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
              failedLabel={t.crmOpportunities.notProvided}
              size="xs"
              className="shrink-0"
            />
          )}
        </div>
      </div>

      {/* Status, Entity Type, Lead Source & Tags Pills (never shows stage age) */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <StatusBadge value={item.status} kind="OpportunityStatus" />

        <Badge size="sm" tone="neutral" className="gap-1">
          {isCorporate ? (
            <Building2 className="size-3 shrink-0" aria-hidden="true" />
          ) : (
            <UserRound className="size-3 shrink-0" aria-hidden="true" />
          )}
          <span>{isCorporate ? cardDict.company : cardDict.individual}</span>
        </Badge>

        {item.leadSourceName && (
          <Badge size="sm" tone="positive" className="max-w-36 gap-1">
            <AcquisitionSourceIcon source={{ iconUrl: item.leadSourceIconUrl }} />
            <bdi className="truncate">{item.leadSourceName}</bdi>
          </Badge>
        )}

        {visibleTags.map((tag) => {
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
          return (
            <Badge key={tag.id} size="compact" tone="neutral" className="max-w-28">
              <bdi className="truncate">{tag.name}</bdi>
            </Badge>
          );
        })}

        {overflowCount > 0 && (
          <Badge size="compact" tone="neutral" className="shrink-0">
            {formatTemplate(cardDict.moreTags, {
              count: formatNumber(overflowCount, lang),
            })}
          </Badge>
        )}
      </div>
    </div>
  );
}
