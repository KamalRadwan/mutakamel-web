import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerMail } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { SenderStatusConfig } from '../outbound-emails.model';

@Component({
  selector: 'app-sender-status',
  imports: [RouterLink, TranslocoPipe, NgIcon, Button],
  providers: [provideIcons({ tablerMail, tablerAlertTriangle })],
  templateUrl: './sender-status.html',
  host: { class: 'block shrink-0 empty:hidden' },
})
export class SenderStatus {
  readonly config = input<SenderStatusConfig | null>(null);
  readonly loading = input(false);
}
