import { Component, computed, inject, input } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Field } from '../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID, RecordLayout } from '../../../../../../shared/ui/record-layout/record-layout';
import { nameIn, type OpportunityRow } from '../../../opportunities.model';

@Component({
  selector: 'app-opp-closing-section',
  imports: [TranslocoPipe, Field],
  providers: [
    provideTranslocoScope(
      { scope: 'opportunity-form', alias: 'oppForm' },
      { scope: 'opportunities', alias: 'opportunities' },
    ),
  ],
  templateUrl: './closing-section.html',
  host: { class: 'block min-w-0' },
})
export class ClosingSection {
  private static nextId = 0;
  protected readonly uid = `opp-closing-${++ClosingSection.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  readonly row = input.required<OpportunityRow>();
  readonly layout = input<RecordLayout>('modal');

  protected readonly pageGrid = RECORD_PAGE_GRID;

  protected readonly isWon = computed(() => this.row().status === 'WON');

  protected readonly statusLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(`opportunities.status.${this.row().status}`);
  });

  protected readonly closedAtText = computed(() => {
    const raw = this.isWon() ? this.row().wonAt : this.row().lostAt;
    if (!raw) return '—';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '—';
    return new Intl.DateTimeFormat(`${this.language()}-u-nu-latn`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(parsed);
  });

  protected readonly governedReason = computed(() => {
    const r = this.row();
    const lang = this.language();
    if (r.status === 'WON' && r.winReason) {
      return nameIn(r.winReason, lang);
    }
    if (r.status === 'LOST' && r.lostReasonRef) {
      return nameIn(r.lostReasonRef, lang);
    }
    return null;
  });

  protected readonly lossNote = computed(() => {
    const r = this.row();
    if (r.status !== 'LOST') return '';
    return r.lostReason?.trim() ?? '';
  });
}
