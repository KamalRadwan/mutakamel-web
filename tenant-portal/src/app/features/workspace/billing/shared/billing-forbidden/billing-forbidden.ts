import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLock } from '@ng-icons/tabler-icons';

@Component({
  selector: 'app-billing-forbidden',
  imports: [TranslocoPipe, NgIcon],
  providers: [provideIcons({ tablerLock })],
  templateUrl: './billing-forbidden.html',
  host: { class: 'flex flex-1 flex-col items-center justify-center gap-8 p-16 text-center' },
})
export class BillingForbidden {}
