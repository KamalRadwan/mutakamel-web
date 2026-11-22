import { Component } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { SeatsSection } from '../seats-section/seats-section';

@Component({
  selector: 'app-subscription-seats-page',
  imports: [TranslocoPipe, SeatsSection],
  providers: [provideTranslocoScope('settings', 'seats', { scope: 'seats-billing', alias: 'sb' })],
  templateUrl: './subscription-seats-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-12' },
})
export class SubscriptionSeatsPage {}
