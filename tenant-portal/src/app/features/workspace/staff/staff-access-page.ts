import { Component, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { RouteError } from '../../../shared/ui/route-error/route-error';
import { StaffReadAccess } from './staff-read-access';

@Component({
  selector: 'app-staff-access-page',
  imports: [RouteError],
  host: { class: 'flex min-h-0 flex-1' },
  template: '<app-route-error kind="forbidden" />',
})
export class StaffAccessPage {
  private readonly router = inject(Router);
  private readonly access = inject(StaffReadAccess);
  private readonly route = inject(ActivatedRoute);
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  constructor() {
    effect(() => {
      const destination = this.access.firstAllowedUrl(this.query());
      if (destination) {
        untracked(() => void this.router.navigateByUrl(destination, { replaceUrl: true }));
      }
    });
  }
}
