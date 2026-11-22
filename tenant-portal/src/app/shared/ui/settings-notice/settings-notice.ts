import { Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerInfoCircle } from '@ng-icons/tabler-icons';

@Component({
  selector: 'app-settings-notice',
  imports: [NgIcon],
  providers: [provideIcons({ tablerInfoCircle, tablerAlertTriangle })],
  templateUrl: './settings-notice.html',
  host: { class: 'block' },
})
export class SettingsNotice {
  readonly tone = input<'info' | 'warning'>('info');
}
