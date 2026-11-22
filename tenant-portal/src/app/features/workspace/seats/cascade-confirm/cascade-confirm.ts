import { DOCUMENT } from '@angular/common';
import {
  ApplicationRef,
  Component,
  ComponentRef,
  DestroyRef,
  ElementRef,
  EnvironmentInjector,
  Service,
  createComponent,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { Button } from '../../../../shared/ui/button/button';
import { CascadeAddonItem } from '../seats.model';

export interface NormalizedCascadeAddon {
  userName: string;
  addonLabel: string;
  isKeyFallback: boolean;
}

@Component({
  selector: 'app-cascade-confirm',
  imports: [NgIcon, TranslocoPipe, Button],
  providers: [
    provideTranslocoScope({ scope: 'seats', alias: 'seats' }),
    provideIcons({ tablerAlertTriangle }),
  ],
  templateUrl: './cascade-confirm.html',
})
export class CascadeConfirmModal {
  private static nextId = 0;
  protected readonly titleId = `seat-cascade-title-${++CascadeConfirmModal.nextId}`;
  protected readonly textId = `seat-cascade-text-${CascadeConfirmModal.nextId}`;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancelBtn = viewChild.required<Button, ElementRef<HTMLButtonElement>>('cancelBtn', {
    read: ElementRef,
  });

  readonly addons = input<NormalizedCascadeAddon[]>([]);

  private resolver: ((confirmed: boolean) => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.settle(false));
  }

  open(): Promise<boolean> {
    this.settle(false);
    const element = this.dialog().nativeElement;
    if (!element.open) {
      element.showModal();
    }
    this.cancelBtn().nativeElement.focus();
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  protected close(confirmed: boolean): void {
    const element = this.dialog().nativeElement;
    if (element.open) {
      element.close();
    }
    this.settle(confirmed);
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.close(false);
  }

  protected onNativeClose(): void {
    if (!this.dialog().nativeElement.open) {
      this.settle(false);
    }
  }

  private settle(confirmed: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    resolve?.(confirmed);
  }
}

function normalizeAddons(addons: readonly CascadeAddonItem[]): NormalizedCascadeAddon[] {
  return addons.map((item) => {
    const addonName = item.addonName.trim();
    return {
      userName: item.userName.trim() || item.userId,
      addonLabel: addonName || item.addonKey,
      isKeyFallback: !addonName,
    };
  });
}

@Service()
export class SeatCascadeConfirm {
  private readonly appRef = inject(ApplicationRef);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);

  private activeRef: ComponentRef<CascadeConfirmModal> | null = null;
  private activeClose: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cleanup());
  }

  async confirm(addons: readonly CascadeAddonItem[]): Promise<boolean> {
    this.activeClose?.();
    this.cleanup();

    const ref = createComponent(CascadeConfirmModal, {
      environmentInjector: this.envInjector,
    });
    this.activeRef = ref;
    ref.setInput('addons', normalizeAddons(addons));
    this.appRef.attachView(ref.hostView);
    this.document.body.appendChild(ref.location.nativeElement);
    ref.changeDetectorRef.detectChanges();

    let closed = false;
    this.activeClose = () => {
      if (!closed) {
        closed = true;
        this.cleanup();
      }
    };

    try {
      return await ref.instance.open();
    } finally {
      closed = true;
      if (this.activeRef === ref) {
        this.activeClose = null;
        this.cleanup();
      }
    }
  }

  private cleanup(): void {
    const ref = this.activeRef;
    this.activeRef = null;
    if (!ref) return;
    this.appRef.detachView(ref.hostView);
    ref.destroy();
  }
}
