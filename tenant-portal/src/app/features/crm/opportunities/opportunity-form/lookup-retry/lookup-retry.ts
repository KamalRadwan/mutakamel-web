import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertCircle } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';

/** Field-level message shown under a field whose options could not load, with a Retry action. */
@Component({
  selector: 'app-opp-lookup-retry',
  imports: [TranslocoPipe, NgIcon, Button],
  providers: [provideIcons({ tablerAlertCircle })],
  host: { class: 'block min-w-0' },
  template: `
    <p role="alert" [id]="id() || null" class="mt-2 flex flex-wrap items-center gap-3 text-11 leading-16 text-danger-text">
      <ng-icon name="tablerAlertCircle" size="11" class="shrink-0" aria-hidden="true" />
      <span>{{ messageKey() | transloco }}</span>
      <button type="button" uiButton variant="ghost" size="small" [disabled]="busy()" (click)="retry.emit()">
        {{ 'oppForm.lookups.retry' | transloco }}
      </button>
    </p>
  `,
})
export class LookupRetry {
  readonly messageKey = input.required<string>();
  readonly id = input('');
  readonly busy = input(false);
  readonly retry = output<void>();
}
