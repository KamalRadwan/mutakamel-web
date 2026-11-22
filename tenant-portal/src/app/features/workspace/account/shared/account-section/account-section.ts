import { Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

@Component({
  selector: 'app-account-section',
  imports: [NgIcon],
  templateUrl: './account-section.html',
  host: { class: 'block rounded-10 border border-border bg-surface p-8 shadow-card' },
})
export class AccountSection {
  private static nextId = 0;

  readonly icon = input.required<string>();
  readonly tile = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input('');

  protected readonly headingId = `account-section-${++AccountSection.nextId}-title`;
}
