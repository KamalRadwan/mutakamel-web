import { Component, ElementRef, inject, input, model, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { Field } from '../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID, RecordLayout } from '../../../../../../shared/ui/record-layout/record-layout';
import { OPPORTUNITY_LIMITS } from '../../../opportunities.model';
import { DraftErrors, OpportunityDraft, resolveOpportunityError } from '../../opportunity-draft';

@Component({
  selector: 'app-opp-deal-section',
  imports: [TranslocoPipe, Field],
  providers: [provideTranslocoScope('opportunities', { scope: 'opportunity-form', alias: 'oppForm' })],
  templateUrl: './deal-section.html',
  host: { class: 'block min-w-0' },
})
export class DealSection {
  private static nextId = 0;
  protected readonly uid = `opp-deal-${++DealSection.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  readonly draft = model.required<OpportunityDraft>();
  readonly layout = input<RecordLayout>('modal');
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);

  protected readonly limits = OPPORTUNITY_LIMITS;
  protected readonly pageGrid = RECORD_PAGE_GRID;

  focusTitle(): void {
    const el = this.titleInput()?.nativeElement;
    if (!el) return;
    el.scrollIntoView({ block: 'nearest' });
    el.focus();
  }

  protected errorText(field: 'title' | 'description', max: number): string | null {
    this.i18n();
    return resolveOpportunityError(this.errors()[field], this.transloco, max);
  }

  protected setTitle(event: Event): void {
    if (this.readonly()) return;
    const title = (event.target as HTMLInputElement).value;
    this.draft.update((current) => ({ ...current, title }));
  }

  protected setDescription(event: Event): void {
    if (this.readonly()) return;
    const description = (event.target as HTMLTextAreaElement).value;
    this.draft.update((current) => ({ ...current, description }));
  }
}
