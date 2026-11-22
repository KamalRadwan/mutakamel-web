import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideTranslocoScopeInherited } from '../../../../../core/i18n/transloco-scope';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowsMaximize } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { RecordNavPosition } from '../nav/record-nav';
import { RecordModalHeader } from './record-modal-header/record-modal-header';

export type RecordModalMode = 'create' | 'view' | 'edit';

export interface RecordModalExtraAction {
  id: string;
  label: string;
  icon: string;
  tone?: 'success' | 'danger';
  disabled?: boolean;
}

/** Shared quick-modal shell for CRM records providing header, dual scroll areas, and create/edit footers. */
@Component({
  selector: 'app-record-modal-frame',
  imports: [NgIcon, TranslocoPipe, Button, Modal, RecordModalHeader],
  viewProviders: [provideTranslocoScopeInherited({ scope: 'record-modal', alias: 'recordModal' })],
  providers: [provideIcons({ tablerArrowsMaximize })],
  templateUrl: './record-modal-frame.html',
})
export class RecordModalFrame {
  private static nextId = 0;
  protected readonly uid = `record-modal-${++RecordModalFrame.nextId}`;

  private readonly modal = viewChild.required(Modal);
  private readonly asideSlot = viewChild<ElementRef<HTMLElement>>('asideSlot');

  readonly open = model(false);
  readonly mode = input<RecordModalMode>('create');
  readonly typeIcon = input('');
  readonly typeTile = input('bg-icon-blue');
  readonly typeTitle = input('');
  readonly subtitle = input<string | null>(null);
  readonly position = input<RecordNavPosition | null>(null);
  readonly dirty = input(false);
  readonly saving = input(false);
  readonly canSave = input(true);
  readonly canDelete = input(false);
  readonly deleteDisabledReason = input<string | null>(null);
  readonly showSaveAndNew = input(true);
  readonly createLabel = input<string | null>(null);
  readonly extraActions = input<readonly RecordModalExtraAction[]>([]);
  readonly ariaLabel = input('');

  readonly deleting = input(false);
  readonly loading = input(false);
  readonly updating = input(false);
  readonly actionsDisabled = input(false);
  readonly saveEnabled = input<boolean | null>(null);
  readonly showFullPage = input(true);
  readonly showClose = input(true);
  readonly dismissable = input(true);
  readonly prevLabel = input<string | null>(null);
  readonly nextLabel = input<string | null>(null);
  readonly closeLabel = input<string | null>(null);

  readonly prev = output<void>();
  readonly next = output<void>();
  readonly requestClose = output<void>();
  readonly save = output<void>();
  readonly saveAndNew = output<void>();
  readonly fullPage = output<void>();
  readonly undo = output<void>();
  readonly delete = output<void>();
  readonly extraAction = output<string>();

  protected readonly hasAside = signal(false);
  private closingFromModel = false;

  protected readonly isCreate = computed(() => this.mode() === 'create');
  protected readonly effectiveAriaLabel = computed(
    () => this.ariaLabel() || this.subtitle()?.trim() || this.typeTitle(),
  );
  protected readonly effectiveDismissable = computed(
    () => this.dismissable() && !this.saving() && !this.deleting(),
  );
  protected readonly footerBusy = computed(
    () => this.saving() || this.deleting() || this.loading() || this.actionsDisabled(),
  );
  protected readonly saveDisabled = computed(
    () => this.footerBusy() || (!this.isCreate() && !(this.saveEnabled() ?? this.dirty())),
  );
  protected readonly showDelete = computed(
    () => !this.isCreate() && (this.canDelete() || !!this.deleteDisabledReason()),
  );
  protected readonly deleteDisabled = computed(
    () => this.footerBusy() || !!this.deleteDisabledReason(),
  );

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const modal = this.modal();
      if (isOpen) {
        this.closingFromModel = false;
        modal.open();
      } else {
        this.closingFromModel = true;
        try {
          modal.close();
        } finally {
          this.closingFromModel = false;
        }
      }
    });

    effect((onCleanup) => {
      const el = this.asideSlot()?.nativeElement;
      if (!el) return;
      const update = () => this.hasAside.set(el.childElementCount > 0);
      update();
      const observer = new MutationObserver(update);
      observer.observe(el, { childList: true });
      onCleanup(() => observer.disconnect());
    });
  }

  protected onDismiss(): void {
    if (!this.open() || !this.effectiveDismissable()) return;
    this.requestClose.emit();
  }

  protected onUiModalClosed(): void {
    if (!this.closingFromModel && this.open()) {
      this.open.set(false);
    }
  }
}
