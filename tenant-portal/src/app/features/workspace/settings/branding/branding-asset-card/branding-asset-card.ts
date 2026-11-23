import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPhoto, tablerUpload } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ApiError } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { Notify } from '../../../../../core/notify/notify';
import { ActionKeys } from '../../core-response.model';
import { BrandingApi } from '../branding.api';
import { Branding, BrandingAssetKind, brandingErrorKey } from '../branding.model';

@Component({
  selector: 'app-branding-asset-card',
  imports: [TranslocoPipe, NgIcon, Button, ConfirmDialog],
  providers: [provideIcons({ tablerPhoto, tablerUpload })],
  templateUrl: './branding-asset-card.html',
})
export class BrandingAssetCard {
  private static nextId = 0;
  protected readonly uid = `branding-asset-${++BrandingAssetCard.nextId}`;

  readonly kind = input.required<BrandingAssetKind>();
  readonly url = input<string | null>(null);
  readonly hasAsset = input<boolean | null>(null);
  readonly canManage = input(false);
  readonly busy = input(false);
  readonly disabled = input(false);
  readonly upload = output<void>();
  readonly removed = output<void>();
  readonly refreshed = output<Branding>();
  readonly removingChange = output<boolean>();
  readonly tenantWideRequired = output<void>();

  private readonly api = inject(BrandingApi);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly confirm = viewChild.required(ConfirmDialog);
  private readonly keys = new ActionKeys(newIdempotencyKey);
  private readonly asset = linkedSignal(() => ({ url: this.url(), present: this.hasAsset() }));
  protected readonly imageFailed = linkedSignal(() => {
    this.url();
    return false;
  });
  protected readonly present = computed(() => this.asset().present ?? Boolean(this.asset().url));
  protected readonly imageUrl = computed(() =>
    this.present() && !this.imageFailed() ? this.asset().url : null,
  );
  protected readonly removing = signal(false);

  protected async remove(): Promise<void> {
    if (!this.canManage() || !this.present() || this.removing() || this.busy() || this.disabled())
      return;
    this.removing.set(true);
    this.removingChange.emit(true);
    try {
      if (!(await this.confirm().open()) || !this.canManage()) return;
      const kind = this.kind();
      const signature = `remove:${kind}`;
      const key = this.keys.keyFor(signature);
      try {
        if (kind === 'logo') await this.api.removeBrandingLogo(key);
        else await this.api.removeBrandingIcon(key);
        this.keys.done(signature);
        this.asset.set({ present: false, url: null });
        this.removed.emit();
        this.notify.success(this.transloco.translate('wsBranding.assets.removed'));
      } catch (error) {
        this.notify.error(brandingErrorKey(error, this.transloco));
        if (error instanceof ApiError && error.code === 'TENANT_WIDE_PERMISSION_REQUIRED')
          this.tenantWideRequired.emit();
        try {
          const branding = await this.api.getBranding();
          this.asset.set(
            kind === 'logo'
              ? { present: branding.hasLogo, url: branding.logoUrl }
              : { present: branding.hasIcon, url: branding.iconUrl },
          );
          this.refreshed.emit(branding);
        } catch {
          // A failed refresh must preserve the last asset and the removal retry key.
        }
      }
    } finally {
      this.removing.set(false);
      this.removingChange.emit(false);
    }
  }

  protected readonly tileClass = computed(() =>
    this.kind() === 'logo'
      ? 'flex h-table-row min-w-time-dd max-w-full shrink-0 items-center justify-center overflow-hidden rounded-8 border border-border bg-surface p-4'
      : 'flex size-table-row shrink-0 items-center justify-center overflow-hidden rounded-8 border border-border bg-surface p-4',
  );
}
