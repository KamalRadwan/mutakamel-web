import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideTranslocoScopeInherited } from '../../../../../core/i18n/transloco-scope';
import { provideIcons } from '@ng-icons/core';
import { tablerUserPlus } from '@ng-icons/tabler-icons';
import { RecordModalHeader } from '../../../shared/record/modal/record-modal-header/record-modal-header';
import { RecordNavPosition } from '../../../shared/record/nav/record-nav';

/** Thin wrapper over `app-record-modal-header` preserving `<app-lead-header>` selector and API. */
@Component({
  selector: 'app-lead-header',
  imports: [TranslocoPipe, RecordModalHeader],
  providers: [provideIcons({ tablerUserPlus })],
  viewProviders: [provideTranslocoScopeInherited({ scope: 'lead-modal', alias: 'leadModal' })],
  templateUrl: './lead-header.html',
  host: { class: 'block shrink-0' },
})
export class LeadHeader {
  readonly mode = input<'create' | 'edit'>('create');
  readonly subtitle = input<string | null>(null);
  readonly updating = input(false);
  readonly position = input<RecordNavPosition | null>(null);
  readonly showClose = input(true);

  readonly prev = output<void>();
  readonly next = output<void>();
  readonly close = output<void>();
}
