import { Component, computed, inject, input, model } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { GeoCountry } from '../../../../../../core/geo/geo.model';
import { CustomFieldDef } from '../../../../shared/record/custom-fields/custom-field.model';
import { RecordCustomFields } from '../../../../shared/record/custom-fields/record-custom-fields';
import { DraftErrors, LeadDraft } from '../../lead-draft';
import { LeadLookups } from '../../lead-lookups';

@Component({
  selector: 'app-lf-custom-fields',
  imports: [RecordCustomFields],
  providers: [provideTranslocoScope({ scope: 'lead-form', alias: 'leadForm' })],
  templateUrl: './custom-fields-section.html',
  host: {
    '[class]': "layout() === 'page' && scope() === 'required' ? 'contents' : 'block'",
  },
})
export class CustomFieldsSection {
  private readonly lookups = inject(LeadLookups);

  readonly layout = input<'modal' | 'page'>('modal');
  readonly draft = model.required<LeadDraft>();
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly scope = input<'required' | 'others' | 'all'>('all');
  /** One column, for the narrow Lead classification column. */
  readonly stacked = input(false);
  readonly countries = input<GeoCountry[]>([]);

  protected readonly fields = computed<readonly CustomFieldDef[]>(() => this.lookups.customFields() ?? []);

  protected onValuesChange(customFields: Record<string, unknown>): void {
    this.draft.update((current) => ({
      ...current,
      customFields,
    }));
  }
}

export { CustomFieldsSection as LfCustomFields };
