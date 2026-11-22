import { Component, input, model } from '@angular/core';
import { FormCheckboxControl } from '@angular/forms/signals';

@Component({
  selector: 'ui-switch',
  templateUrl: './switch.html',
  host: { class: 'inline-flex' },
})
export class Switch implements FormCheckboxControl {
  readonly checked = model(false);
  readonly disabled = input(false);
  readonly label = input('');
  readonly describedBy = input<string | null>(null);
  readonly id = input<string | null>(null);

  protected toggle() {
    if (!this.disabled()) {
      this.checked.set(!this.checked());
    }
  }
}
