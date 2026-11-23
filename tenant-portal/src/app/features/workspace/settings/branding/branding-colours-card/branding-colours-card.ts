import { Component, computed, input, model, output, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPalette } from '@ng-icons/tabler-icons';
import { ColorPicker } from '../../../../../shared/ui/color-picker/color-picker';
import { Field } from '../../../../../shared/ui/field/field';
import { BrandingColoursErrors, normaliseHex } from '../branding.model';

@Component({
  selector: 'app-branding-colours-card',
  imports: [TranslocoPipe, NgIcon, ColorPicker, Field],
  providers: [provideIcons({ tablerPalette })],
  templateUrl: './branding-colours-card.html',
})
export class BrandingColoursCard {
  private static nextId = 0;
  protected readonly uid = `branding-colours-${++BrandingColoursCard.nextId}`;

  private readonly primaryPicker = viewChild<ColorPicker>('primaryPicker');
  private readonly secondaryPicker = viewChild<ColorPicker>('secondaryPicker');

  readonly primary = model('');
  readonly secondary = model('');
  readonly errors = input<BrandingColoursErrors>({ primary: null, secondary: null });
  readonly readOnly = input(false);
  readonly fieldBlur = output<'primary' | 'secondary'>();

  protected readonly primaryHex = computed(() => normaliseHex(this.primary()));
  protected readonly secondaryHex = computed(() => normaliseHex(this.secondary()));

  focusField(field: 'primary' | 'secondary'): void {
    const target = field === 'primary' ? this.primaryPicker() : this.secondaryPicker();
    target?.focus();
  }

  protected onPrimaryPicked(value: string | null): void {
    if (this.readOnly()) return;
    if (value === null) {
      this.primary.set('');
      return;
    }
    if (normaliseHex(this.primary()) === normaliseHex(value)) return;
    this.primary.set(value);
  }

  protected onPrimaryRawInput(raw: string): void {
    if (this.readOnly()) return;
    this.primary.set(raw);
  }

  protected onSecondaryPicked(value: string | null): void {
    if (this.readOnly()) return;
    if (value === null) {
      this.secondary.set('');
      return;
    }
    if (normaliseHex(this.secondary()) === normaliseHex(value)) return;
    this.secondary.set(value);
  }

  protected onSecondaryRawInput(raw: string): void {
    if (this.readOnly()) return;
    this.secondary.set(raw);
  }
}
