import { Component, computed, inject, input, model, signal } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { TIMEZONE_MAX_LENGTH, TimezoneOption } from '../workspace-settings.model';

const MAX_MATCHES = 50;
const NO_MATCH_VALUE = '__ws_tz_no_match__';

@Component({
  selector: 'app-timezone-picker',
  imports: [TranslocoPipe, Dropdown, Field],
  templateUrl: './timezone-picker.html',
  host: { class: 'block' },
})
export class TimezonePicker {
  private static nextId = 0;
  protected readonly uid = `timezone-picker-${++TimezonePicker.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly value = model('');
  readonly savedValue = input<string | null>(null);
  readonly disabled = input(false);
  readonly required = input(true);
  readonly error = input<string | null>(null);
  readonly options = input<readonly TimezoneOption[]>([]);
  readonly fallbackInput = input(false);

  protected readonly maxLength = TIMEZONE_MAX_LENGTH;
  protected readonly search = signal('');

  protected readonly useFallback = computed(() => this.fallbackInput() || this.options().length === 0);

  protected readonly dropdownOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const list = this.options();
    const byValue = new Map<string, TimezoneOption>();
    for (const option of list) {
      byValue.set(option.value, option);
    }

    const toDropdownOption = (zone: string): DropdownOption<string> => {
      const match = byValue.get(zone);
      if (!match) return { value: zone, label: zone };
      return {
        value: match.value,
        label: match.offset ? `${match.label} (UTC${match.offset})` : match.label,
      };
    };

    const query = this.search().trim().toLowerCase();
    const matches = query
      ? list.filter(
          (option) =>
            option.value.toLowerCase().includes(query) || option.label.toLowerCase().includes(query),
        )
      : list;

    const result: DropdownOption<string>[] = [];
    const seen = new Set<string>();

    if (query && matches.length === 0) {
      result.push({
        value: NO_MATCH_VALUE,
        label: this.transloco.translate('wsGeneral.timezone.noMatch'),
        disabled: true,
      });
    }

    for (const option of matches.slice(0, MAX_MATCHES)) {
      if (seen.has(option.value)) continue;
      seen.add(option.value);
      result.push(toDropdownOption(option.value));
    }

    const currentZone = this.value().trim();
    if (currentZone && !seen.has(currentZone)) {
      seen.add(currentZone);
      result.push(toDropdownOption(currentZone));
    }

    const savedZone = this.savedValue()?.trim() ?? '';
    if (savedZone && !seen.has(savedZone)) {
      seen.add(savedZone);
      result.push(toDropdownOption(savedZone));
    }

    return result;
  });

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onManualInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected onSelect(next: string): void {
    if (next === NO_MATCH_VALUE) return;
    this.value.set(next);
  }
}
