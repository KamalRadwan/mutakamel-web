import { Component, input, model } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

export interface ViewOption {
  id: string;
  icon: string;
  label: string;
}

@Component({
  selector: 'ui-view-switcher',
  imports: [NgIcon],
  host: {
    role: 'radiogroup',
    '[attr.aria-label]': 'label()',
    class: 'inline-flex shrink-0 items-center gap-2 rounded-10 bg-neutral-soft p-3',
  },
  template: `
    @for (option of options(); track option.id) {
      <button
        type="button"
        role="radio"
        class="inline-flex h-field cursor-pointer items-center rounded-8 px-10 text-12 outline-none transition-colors duration-fast focus-visible:ring-3 focus-visible:ring-focus-halo-strong"
        [class]="option.id === value() ? 'bg-brand text-on-brand' : 'text-text-muted hover:text-text'"
        [attr.aria-checked]="option.id === value()"
        [attr.aria-label]="option.label"
        [title]="option.label"
        (click)="value.set(option.id)"
      >
        <ng-icon [name]="option.icon" size="14" aria-hidden="true" />
      </button>
    }
  `,
})
export class ViewSwitcher {
  readonly options = input.required<ViewOption[]>();
  readonly label = input.required<string>();
  readonly value = model.required<string>();
}
