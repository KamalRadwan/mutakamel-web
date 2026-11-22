import { Component, output } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerRefresh } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';

/** Full-page state shown when the signed-in user's session could not be loaded. */
@Component({
  selector: 'app-session-failed-state',
  imports: [NgIcon, TranslocoPipe, Button],
  providers: [provideTranslocoScope({ scope: 'ws-session', alias: 'wsSession' }), provideIcons({ tablerRefresh })],
  template: `
    <section role="alert" class="flex flex-1 flex-col items-center justify-center gap-8 p-16 text-center">
      <span class="inline-flex size-icon-tile-lg items-center justify-center rounded-8 bg-icon-red text-on-icon">
        <ng-icon name="tablerRefresh" size="18" aria-hidden="true" />
      </span>
      <h2 class="text-16 leading-24 font-medium text-text">{{ 'wsSession.failedTitle' | transloco }}</h2>
      <p class="text-12 leading-18 text-text-muted">{{ 'wsSession.failedText' | transloco }}</p>
      <button type="button" uiButton variant="primary" (click)="retry.emit()">
        {{ 'wsSession.retry' | transloco }}
      </button>
    </section>
  `,
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class SessionFailedState {
  readonly retry = output<void>();
}
