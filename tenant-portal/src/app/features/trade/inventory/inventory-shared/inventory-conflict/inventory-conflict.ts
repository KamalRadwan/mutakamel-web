import { Component, output, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';

@Component({
  selector: 'app-inventory-conflict',
  imports: [Modal, Button, TranslocoPipe],
  providers: [provideIcons({ tablerAlertTriangle })],
  templateUrl: './inventory-conflict.html',
})
export class InventoryConflict {
  private readonly modal = viewChild.required<Modal>('dialog');

  readonly reload = output<void>();
  readonly cancelled = output<void>();

  private suppressCancelled = false;

  open(): void {
    this.modal().open();
  }

  close(): void {
    this.suppressCancelled = true;
    try {
      this.modal().close();
    } finally {
      this.suppressCancelled = false;
    }
  }

  protected onReload(): void {
    this.reload.emit();
    this.close();
  }

  protected onCancel(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (!this.suppressCancelled) {
      this.cancelled.emit();
    }
  }
}
