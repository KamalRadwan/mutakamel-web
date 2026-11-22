import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { FullState } from '../../shared/ui/full-state/full-state';

@Component({
  selector: 'app-tenant-provisioning-page',
  imports: [TranslocoPipe, FullState],
  templateUrl: './tenant-provisioning-page.html',
  host: { class: 'flex min-h-0 flex-1' },
})
export class TenantProvisioningPage {
  readonly checking = input(false);
  readonly retryRequested = output<void>();
}
