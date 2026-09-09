"use client";

import { Button, ContactChannelIcon } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { splitPhoneNumber } from "@/lib/geo/country-data";

/**
 * One stored number, in the two forms this row needs.
 *
 * `splitPhoneNumber` and nothing else: it is the same helper
 * `CrmPhoneNumberInput` splits on, ported behaviour-for-behaviour from the
 * admin portal, and it already knows the two things a hand-rolled `replace`
 * here would get wrong — that `00` is how a `+` is written from a keypad, and
 * that calling codes are not prefix-free, so `+1242` must beat `+1` or every
 * Bahamian number dials North America. A second implementation would drift
 * from the editor's the first time either changed.
 *
 * - `full` is what the row DISPLAYS: the whole number in one piece, reassembled
 *   from the split so `00201050049899` and `+20 105 0049 899` read alike. Edit
 *   mode is where it comes apart into code and national number, which is the
 *   editor's job and not this row's.
 * - `digits` is what `wa.me` and `t.me` are addressed with: they reject a `+`
 *   in the path and resolve bare digits as an international number. `tel:`
 *   keeps the plus, which is what tells a dialler not to guess a country.
 */
function companyPhoneForms(phone: string): {
  full: string;
  digits: string;
  hasCallingCode: boolean;
} {
  const parsed = splitPhoneNumber(phone);
  if (!parsed) return { full: phone, digits: "", hasCallingCode: false };
  const { callingCode, nationalNumber } = parsed;
  return {
    full: `${callingCode}${nationalNumber}`,
    digits: `${callingCode.replace("+", "")}${nationalNumber}`,
    hasCallingCode: callingCode.length > 0,
  };
}

/**
 * One company number, reachable three ways.
 *
 * The number is TEXT, not an input, and stays text even while the rest of the
 * card is being edited elsewhere: this is what it is used for a hundred times
 * for every once it is corrected. Correcting it is the card's own edit mode,
 * which replaces this row wholesale with the split code/number editor —
 * because these three actions would otherwise point at a number no longer on
 * screen, and a control that acts on stale data is worse than one that is
 * briefly absent.
 *
 * WhatsApp and Telegram are offered only for a number that carries a calling
 * code. Both resolve their path as an INTERNATIONAL number, so `wa.me/010…`
 * opens an error page rather than a chat, and a link that always fails is
 * worse than one that is not there. `tel:` stays either way — a dialler can
 * complete a national number from the handset's own network.
 *
 * `dir="ltr"` on the number: a phone number is a left-to-right sequence whose
 * `+` migrates visibly under RTL bidi resolution.
 */
export function LeadCompanyPhoneRow({ phone }: { phone: string }) {
  const { t } = useI18n();
  const { full, digits, hasCallingCode } = companyPhoneForms(phone);

  return (
    <div className="flex items-center gap-1">
      <span className="min-w-0 flex-1 truncate" dir="ltr">
        {full}
      </span>
      {/* Every one of the three names the number it acts on: a row of three
          identical "Call" labels in a list of four numbers tells a
          screen-reader user which action but never which number. */}
      <Button variant="ghost" size="xs" className="w-(--size-control-xs) shrink-0 px-1" asChild>
        <a
          href={`tel:${full}`}
          aria-label={formatTemplate(t.crmLeadDetail.callNumber, { value: full })}
          title={t.crmLeadDetail.callAction}
        >
          <ContactChannelIcon channel="call" />
        </a>
      </Button>
      {hasCallingCode && (
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
