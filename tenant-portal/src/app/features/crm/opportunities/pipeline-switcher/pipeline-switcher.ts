import { Component, computed, inject, input, output } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerHierarchy2 } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { type PipelineView, nameIn } from '../opportunities.model';

export const ALL_PIPELINES_VALUE = '__all__';

@Component({
  selector: 'app-pipeline-switcher',
  imports: [Dropdown],
  providers: [provideIcons({ tablerHierarchy2 })],
  templateUrl: './pipeline-switcher.html',
  host: {
    class: 'inline-flex shrink-0',
    '[attr.title]': 'switcherTitle()',
  },
})
export class PipelineSwitcher {
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly pipelines = input.required<PipelineView[]>();
  readonly value = input<string | null>(null);
  readonly allowAll = input(false);
  readonly disabled = input(false);
  readonly valueChange = output<string | null>();

  protected readonly switcherLabel = computed(() => {
    this.i18n();
    return this.transloco.translate('opportunities.page.pipelineLabel');
  });

  protected readonly switcherTitle = computed(() => {
    this.i18n();
    return this.transloco.translate('opportunities.page.pipelineTitle');
  });

  protected readonly options = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    const defaultSuffix = this.transloco.translate('opportunities.page.pipelineDefault');
    const items: DropdownOption<string>[] = [];

    if (this.allowAll()) {
      items.push({
        value: ALL_PIPELINES_VALUE,
        label: this.transloco.translate('opportunities.page.allPipelines'),
      });
    }

    for (const pipeline of this.pipelines()) {
      const name = nameIn(pipeline, lang);
      items.push({
        value: pipeline.id,
        label: pipeline.isDefault ? `${name} · ${defaultSuffix}` : name,
      });
    }

    return items;
  });

  protected readonly dropdownValue = computed<string>(() => {
    const current = this.value();
    if (current) return current;
    if (this.allowAll()) return ALL_PIPELINES_VALUE;
    return this.pipelines()[0]?.id ?? '';
  });

  protected onSelect(next: string): void {
    if (next === ALL_PIPELINES_VALUE) {
      if (this.value() !== null) {
        this.valueChange.emit(null);
      }
      return;
    }
    if (next && next !== this.value()) {
      this.valueChange.emit(next);
    }
  }
}
