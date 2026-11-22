import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPhoto, tablerUpload } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { BrandingAssetKind } from '../branding.model';

@Component({
  selector: 'app-branding-asset-card',
  imports: [TranslocoPipe, NgIcon, Button],
  providers: [provideIcons({ tablerPhoto, tablerUpload })],
  templateUrl: './branding-asset-card.html',
})
export class BrandingAssetCard {
  private static nextId = 0;
  protected readonly uid = `branding-asset-${++BrandingAssetCard.nextId}`;

  readonly kind = input.required<BrandingAssetKind>();
  readonly url = input<string | null>(null);
  readonly canManage = input(false);
  readonly busy = input(false);
  readonly disabled = input(false);
  readonly upload = output<void>();

  protected readonly tileClass = computed(() =>
    this.kind() === 'logo'
      ? 'flex h-table-row min-w-time-dd max-w-full shrink-0 items-center justify-center overflow-hidden rounded-8 border border-border bg-surface p-4'
      : 'flex size-table-row shrink-0 items-center justify-center overflow-hidden rounded-8 border border-border bg-surface p-4',
  );
}
