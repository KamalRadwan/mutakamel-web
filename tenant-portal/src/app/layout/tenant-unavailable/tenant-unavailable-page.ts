import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { FullState } from '../../shared/ui/full-state/full-state';

/** Shown when the workspace host no longer resolves to a tenant (Core 404 TENANT_NOT_RESOLVABLE). Sign-in cannot help here. */
@Component({
  selector: 'app-tenant-unavailable-page',
  imports: [TranslocoPipe, FullState],
  template: `
    <ui-full-state
      kind="not-found"
      [title]="'errors.tenantUnavailable.title' | transloco"
      [text]="'errors.tenantUnavailable.text' | transloco: { host: host }"
      [actionLabel]="'errors.tenantUnavailable.retry' | transloco"
      (action)="retry()"
    />
  `,
  host: { class: 'flex min-h-dvh flex-1 bg-page' },
})
export class TenantUnavailablePage {
  private readonly document = inject(DOCUMENT);
  protected readonly host = this.document.location?.host ?? '';

  protected retry(): void {
    this.document.location?.assign('/');
  }
}
