"use client";

import { Mail, MapPin, Phone, Target, UserRound } from "lucide-react";
import { Badge, Button, CopyButton, TagChip, toTagColor } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { leadCountryIso } from "../../lead-card-contract";
import type { LeadItem, LeadStage } from "../../lead-list-contract";
import { LeadPhoneActionsRow } from "../LeadPhoneActionsRow";

function stageBadgeTone(stage: LeadStage | undefined): "positive" | "negative" | "neutral" {
  if (stage?.flag === "QUALIFIED" || stage?.flag === "CONVERTED") return "positive";
  if (stage?.flag === "DISQUALIFIED") return "negative";
  return "neutral";
}

interface LeadGridCardBodyProps {
  lead: LeadItem;
  stage: LeadStage | undefined;
  contactName: string | null;
  canEdit: boolean;
  onOpenQuickModal: () => void;
}

export function LeadGridCardBody({
  lead,
  stage,
  contactName,
  canEdit,
  onOpenQuickModal,
}: LeadGridCardBodyProps) {
  const { t, lang } = useI18n();
  const cardDict = t.crmLeads.card;
  const isCompany = lead.leadProfileType === "CORPORATE";
  const contactRole = lead.primaryContact?.jobTitle.trim() ?? "";

  const countryIso = leadCountryIso(lead.country);
  const rawCountry = lead.country.trim();
  const countryDisplay =
    rawCountry && rawCountry.toUpperCase() !== countryIso ? rawCountry : "";
  const locationText = [countryDisplay, lead.city?.trim() ?? ""].filter(Boolean).join(" · ");
  const taxNumber = lead.taxNumber?.trim() ?? "";
  const crNumber = lead.commercialRegistrationNumber?.trim() ?? "";
  const legalNumber = taxNumber || crNumber;
  const legalLabel = taxNumber
    ? t.crmLeads.create.taxNumber
    : t.crmLeads.create.commercialRegistrationNumber;
  const hasLocationOrLegal = Boolean(countryIso || locationText || legalNumber);

  const primaryPhone = (
    (isCompany ? lead.primaryContact?.phones[0] || lead.phone : lead.phone) ||
    lead.phones[0] ||
    ""
  ).trim();
  const primaryEmail = (
    (isCompany ? lead.primaryContact?.email || lead.email : lead.email) || ""
  ).trim();

  const needSnippet = (
    lead.interestSummary ||
    lead.expectedNeed ||
    lead.description ||
    ""
  ).trim();
  const targetLine = (lead.expectedNeed || "").trim();
  const showTargetLine = targetLine.length > 0 && targetLine !== needSnippet;

  const stageLabel = stage ? localizedName(stage, lang).trim() : "";
  const sourceLabel = localizedValue(lead.sourceNameAr, lead.sourceNameEn, lang).trim();
  const visibleTags = lead.tags.slice(0, 2);
  const overflowCount = Math.max(0, lead.tags.length - visibleTags.length);
  const showSourceBadge =
    sourceLabel.length > 0 &&
    !visibleTags.some((tag) => tag.name.trim().toLowerCase() === sourceLabel.toLowerCase());
  const hasMetaRow = stageLabel.length > 0 || showSourceBadge || visibleTags.length > 0;

  return (
    <div className="flex flex-col gap-2">
      {hasLocationOrLegal && (
        <div className="flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
          <MapPin className="size-3 shrink-0" aria-hidden="true" />
          <p className="min-w-0 truncate">
            {countryIso && <span className="font-semibold text-foreground-secondary">{`${countryIso} `}</span>}
            {locationText && <bdi>{locationText}</bdi>}
            {locationText && legalNumber && <span aria-hidden="true">{" · "}</span>}
            {legalNumber && (
              <bdi dir="ltr" title={legalLabel} className="font-mono tabular-nums">
                {legalNumber}
              </bdi>
            )}
          </p>
        </div>
      )}

      {/* Primary Contact, Phone + Instant Actions, and Email */}
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
            {isCompany && (
              <Badge size="sm" tone="neutral" className="shrink-0">
                {cardDict.primary}
              </Badge>
            )}
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
            ) : canEdit ? (
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
                {t.crmLeads.unavailable}
              </span>
            )}
          </div>

          {primaryPhone && (
            <LeadPhoneActionsRow phone={primaryPhone} country={lead.country} actionsOnly />
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
              failedLabel={t.crmLeads.unavailable}
              size="xs"
              className="shrink-0"
            />
          )}
        </div>
      </div>

      {/* Need Snippet & Expected Need Target Line */}
      {needSnippet.length > 0 && (
        <div className="flex flex-col gap-1 border-s-2 border-s-primary ps-2.5">
          <p dir="auto" className="line-clamp-2 text-caption text-foreground-secondary">
            {needSnippet}
          </p>
          {showTargetLine && (
            <div className="flex min-w-0 items-center gap-1 text-caption font-semibold text-primary">
              <Target className="size-3 shrink-0" aria-hidden="true" />
              <span dir="auto" className="truncate">
                {targetLine}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stage + Source + Tags Pills (never shows time-in-stage) */}
      {hasMetaRow && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {stageLabel.length > 0 && (
            <Badge size="sm" tone={stageBadgeTone(stage)} className="max-w-32">
              <bdi className="truncate">{stageLabel}</bdi>
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
                  size="sm"
                  label={tag.name}
                  backgroundColor={tag.backgroundColor}
                  textColor={tag.textColor}
                  className="h-6 max-w-28 rounded-md font-semibold"
                />
              );
            }
            const defaultTone = !showSourceBadge && index === 0 ? "positive" : "neutral";
            return (
              <Badge key={tag.id} size="sm" tone={defaultTone} className="max-w-28">
                <bdi className="truncate">{tag.name}</bdi>
              </Badge>
            );
          })}

          {overflowCount > 0 && (
            <Badge size="sm" tone="neutral" className="shrink-0">
              {formatTemplate(cardDict.moreTags, { count: formatNumber(overflowCount, lang) })}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
