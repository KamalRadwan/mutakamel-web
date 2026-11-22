import { Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

@Component({
  selector: 'app-settings-section',
  imports: [NgIcon],
  templateUrl: './settings-section.html',
  host: { class: 'block' },
})
export class SettingsSection {
  readonly icon = input.required<string>();
  readonly tile = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
