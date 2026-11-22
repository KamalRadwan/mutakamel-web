import { Component, computed, inject, input } from '@angular/core';
import { LanguageState } from '../../../../../core/i18n/language';
import { formatQuantity, signOf } from '../../inventory.service';

@Component({
  selector: 'app-inventory-quantity',
  host: { class: 'inline-flex items-baseline gap-4 whitespace-nowrap' },
  template: `
    <bdi dir="ltr" class="tabular-nums" [class]="toneClass()">{{ formatted() }}</bdi>
    @if (uom(); as code) {
      <span class="text-text-muted">{{ code }}</span>
    }
  `,
})
export class InventoryQuantity {
  private readonly lang = inject(LanguageState).current;

  readonly value = input.required<string>();
  readonly uom = input<string | null>(null);
  readonly signed = input(false);

  private readonly sign = computed(() => signOf(this.value()));

  protected readonly formatted = computed(() => {
    const raw = formatQuantity(this.value(), this.lang());
    if (raw === '—' || !this.signed()) return raw;
    const s = this.sign();
    if (s > 0) return `+${raw}`;
    if (s < 0) return `\u2212${raw.replace(/^-/, '')}`;
    return raw;
  });

  protected readonly toneClass = computed(() => {
    if (!this.signed()) return '';
    const s = this.sign();
    if (s > 0) return 'text-success-text';
    if (s < 0) return 'text-danger-text';
    return '';
  });
}
