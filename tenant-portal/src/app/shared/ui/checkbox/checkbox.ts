import { Component, input, model } from '@angular/core';
import { FormCheckboxControl } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck } from '@ng-icons/tabler-icons';

@Component({
  selector: 'ui-checkbox',
  imports: [NgIcon],
  providers: [provideIcons({ tablerCheck })],
  templateUrl: './checkbox.html',
  host: { class: 'inline-flex', '[attr.aria-label]': 'null' },
})
export class Checkbox implements FormCheckboxControl {
  readonly checked = model(false);
  /** Mixed state: sets the native indeterminate flag and aria-checked="mixed" on the real input. */
  readonly indeterminate = input(false);
  readonly disabled = input(false);
  /** Accessible name; lands on the real input, never on the host. */
  readonly ariaLabel = input<string | null>(null, { alias: 'aria-label' });

  protected toggle(event: Event) {
    this.checked.set((event.target as HTMLInputElement).checked);
  }
}
