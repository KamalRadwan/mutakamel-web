import { DOCUMENT } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { StatusScreen, StatusScreenNote } from '../status-screen/status-screen';

@Component({
  selector: 'app-tenant-unavailable-page',
  imports: [TranslocoPipe, StatusScreen],
  template: `
    <app-status-screen
      icon="tablerWorldOff"
      [title]="'errors.tenantUnavailable.title' | transloco"
      [text]="'errors.tenantUnavailable.text' | transloco"
      [notes]="notes()"
      [actionLabel]="'errors.tenantUnavailable.retry' | transloco"
      (action)="retry()"
    />
  `,
})
export class TenantUnavailablePage {
  private readonly document = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  protected readonly host = this.document.location?.host ?? '';
  protected readonly notes = computed<StatusScreenNote[]>(() => {
    this.lang();
    return [
      ...(this.host ? [{ icon: 'tablerWorld', text: this.host, ltr: true }] : []),
      { icon: 'tablerHeadset', text: this.transloco.translate('errors.tenantUnavailable.support') },
    ];
  });

  protected retry(): void {
    this.document.location?.assign('/');
  }
}
