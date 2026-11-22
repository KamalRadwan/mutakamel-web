import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';

@Component({
  selector: 'app-billing-failed',
  imports: [TranslocoPipe, NgIcon, Button],
  providers: [provideIcons({ tablerAlertTriangle })],
  templateUrl: './billing-failed.html',
  host: { class: 'flex flex-1 flex-col items-center justify-center gap-8 p-16 text-center' },
})
export class BillingFailed {
  readonly correlationId = input<string | null>(null);
  readonly retry = output<void>();
}
