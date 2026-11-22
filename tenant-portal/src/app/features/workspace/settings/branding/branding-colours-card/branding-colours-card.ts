import { Component, ElementRef, computed, input, model, output, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPalette } from '@ng-icons/tabler-icons';
import { Field } from '../../../../../shared/ui/field/field';
import { BRANDING_COLOUR_MAX, BrandingColoursErrors, normaliseHex } from '../branding.model';

const INPUT_BASE_CLASS =
  'h-field min-w-0 flex-1 rounded-8 border bg-surface-field px-8 text-12 text-text tabular-nums outline-none transition-colors duration-fast placeholder:text-text-placeholder';
const INPUT_NORMAL_CLASS =
  'border-border-field hover:border-border-field-hover focus:border-focus-ring focus:ring-3 focus:ring-focus-halo';
const INPUT_ERROR_CLASS = 'border-danger-border ring-2 ring-danger-halo';

@Component({
  selector: 'app-branding-colours-card',
  imports: [TranslocoPipe, NgIcon, Field],
  providers: [provideIcons({ tablerPalette })],
  templateUrl: './branding-colours-card.html',
})
export class BrandingColoursCard {
  private static nextId = 0;
  protected readonly uid = `branding-colours-${++BrandingColoursCard.nextId}`;

  private readonly primaryInput = viewChild<ElementRef<HTMLInputElement>>('primaryInput');
  private readonly secondaryInput = viewChild<ElementRef<HTMLInputElement>>('secondaryInput');

  readonly primary = model('');
  readonly secondary = model('');
  readonly errors = input<BrandingColoursErrors>({ primary: null, secondary: null });
  readonly readOnly = input(false);
  readonly fieldBlur = output<'primary' | 'secondary'>();

  protected readonly colourMax = BRANDING_COLOUR_MAX;

  protected readonly primaryHex = computed(() => normaliseHex(this.primary()));
  protected readonly secondaryHex = computed(() => normaliseHex(this.secondary()));

  protected readonly primarySwatchClass = computed(() => {
    if (this.primaryHex()) return 'size-icon-tile-sm shrink-0 rounded-6 border border-border';
    if (!this.primary().trim()) return 'size-icon-tile-sm shrink-0 rounded-6 border border-border bg-brand';
    return 'size-icon-tile-sm shrink-0 rounded-6 border border-dashed border-danger bg-neutral-soft';
  });

  protected readonly secondarySwatchClass = computed(() => {
    if (this.secondaryHex()) return 'size-icon-tile-sm shrink-0 rounded-6 border border-border';
    if (!this.secondary().trim()) return 'size-icon-tile-sm shrink-0 rounded-6 border border-border bg-neutral-soft';
    return 'size-icon-tile-sm shrink-0 rounded-6 border border-dashed border-danger bg-neutral-soft';
  });

  protected readonly primaryInputClass = computed(
    () => `${INPUT_BASE_CLASS} ${this.errors().primary ? INPUT_ERROR_CLASS : INPUT_NORMAL_CLASS}`,
  );

  protected readonly secondaryInputClass = computed(
    () => `${INPUT_BASE_CLASS} ${this.errors().secondary ? INPUT_ERROR_CLASS : INPUT_NORMAL_CLASS}`,
  );

  focusField(field: 'primary' | 'secondary'): void {
    const target = field === 'primary' ? this.primaryInput() : this.secondaryInput();
    target?.nativeElement.focus();
  }

  protected onPrimaryInput(event: Event): void {
    this.primary.set((event.target as HTMLInputElement).value);
  }

  protected onSecondaryInput(event: Event): void {
    this.secondary.set((event.target as HTMLInputElement).value);
  }
}
