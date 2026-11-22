import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { formatDate, formatMoney } from '../../../shared/trade-format';
import { STATUS_TONE_CLASSES, statusBadge } from '../../shared/document-status';
import type { QuotationRevision } from '../../shared/document.model';

const TIME_24H = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface RevisionRowView {
  readonly id: string;
  readonly revisionNumber: number;
  readonly isCurrent: boolean;
  readonly badgeLabelKey: string;
  readonly badgeClass: string;
  readonly validUntilDmy: string;
  readonly timestampKey: 'tdpg.revisions.sentAt' | 'tdpg.revisions.createdAt';
  readonly timestampFormatted: string;
  readonly totalFormatted: string;
}

function formatDmy(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return '—';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

@Component({
  selector: 'app-revisions-panel',
  imports: [TranslocoPipe, Badge],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-documents', alias: 'td' },
      { scope: 'trade-documents-page', alias: 'tdpg' },
    ),
  ],
  templateUrl: './revisions-panel.html',
  host: { class: 'block min-w-0' },
})
export class RevisionsPanel {
  private readonly lang = inject(LanguageState).current;

  readonly revisions = input.required<readonly QuotationRevision[]>();
  readonly currentRevisionId = input<string | null>(null);
  readonly currencyCode = input.required<string>();

  protected readonly rows = computed<RevisionRowView[]>(() => {
    const currentId = this.currentRevisionId();
    const currency = this.currencyCode();
    const language = this.lang();

    return this.revisions()
      .slice()
      .sort((a, b) => b.revisionNumber - a.revisionNumber)
      .map((rev) => {
        const isCurrent = rev.id === currentId;
        const badge = isCurrent
          ? statusBadge('quotation', 'lifecycle', rev.status)
          : { labelKey: 'tdpg.revisions.replaced', tone: 'none' as const };
        const timeIso = rev.sentAt ?? rev.createdAt;
        const timeMs = Date.parse(timeIso);
        const datePart = formatDate(timeIso, language);
        const timePart = Number.isFinite(timeMs) ? TIME_24H.format(new Date(timeMs)) : '';
        const timestampFormatted = timePart ? `${datePart} ${timePart}` : datePart;

        return {
          id: rev.id,
          revisionNumber: rev.revisionNumber,
          isCurrent,
          badgeLabelKey: badge.labelKey,
          badgeClass: STATUS_TONE_CLASSES[badge.tone],
          validUntilDmy: `\u2066${formatDmy(rev.validUntil)}\u2069`,
          timestampKey: rev.sentAt ? 'tdpg.revisions.sentAt' : 'tdpg.revisions.createdAt',
          timestampFormatted,
          totalFormatted: formatMoney(currency, rev.grandTotal),
        };
      });
  });
}
