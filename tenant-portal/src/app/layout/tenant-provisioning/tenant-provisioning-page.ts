import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { StatusScreen } from '../status-screen/status-screen';

@Component({
  selector: 'app-tenant-provisioning-page',
  imports: [TranslocoPipe, StatusScreen],
  templateUrl: './tenant-provisioning-page.html',
  host: { class: 'block' },
})
export class TenantProvisioningPage {
  readonly checking = input(false);
  readonly retryRequested = output<void>();
}
