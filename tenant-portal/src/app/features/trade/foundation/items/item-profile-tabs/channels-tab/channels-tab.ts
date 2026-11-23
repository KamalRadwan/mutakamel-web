import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArchive,
  tablerArrowBackUp,
  tablerBriefcase,
  tablerBroadcast,
  tablerBuildingSkyscraper,
  tablerBuildingStore,
  tablerCashRegister,
  tablerMapPin,
  tablerPlayerPlay,
  tablerPlugConnected,
  tablerPlus,
  tablerRefresh,
  tablerShoppingCart,
} from '@ng-icons/tabler-icons';
import { ApiError as CoreApiError } from '../../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Notify } from '../../../../../../core/notify/notify';
import { ScopeState } from '../../../../../../core/scope/scope';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { SectionBar } from '../../../../../../shared/ui/section-bar/section-bar';
import { Segmented, type SegmentedOption } from '../../../../../../shared/ui/segmented/segmented';
import { UnsavedDialog } from '../../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, errorCodeOf, newIdempotencyKey, tradeContext, type TradeContext } from '../../../../shared/trade-api';
import { formatDate } from '../../../../shared/trade-format';
import type {
  ChannelListing,
  ItemCompanyProfile,
  ItemStatus,
  ListingStatus,
} from '../../../../shared/trade-foundation.model';
import {
  BADGE_CLASS,
  CHANNEL_TYPE_KEY,
  CHANNEL_TYPE_TILE,
  LISTING_STATUS_KEY,
  type TileSpec,
} from '../../../../shared/trade-labels';
import { createListing, itemErrorKey, listItemListings, listListingChannels, patchListing } from '../../items.api';
import { actionKey } from '../../../action-keys';
import type { ListingChannelOption } from '../../items.model';

type ListingScope = 'company' | 'branch';
type ListingActionId = 'publish' | 'toDraft' | 'retire';

const LISTING_STATUS_BADGE: Record<ListingStatus, string> = {
  DRAFT: BADGE_CLASS.neutral,
  PUBLISHED: BADGE_CLASS.published,
  RETIRED: BADGE_CLASS.muted,
};

function isForbiddenError(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof CoreApiError) && error.status === 403;
}

@Component({
  selector: 'app-item-channels-tab',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Button, Dropdown, Field, SectionBar, Segmented, UnsavedDialog],
  providers: [
    provideIcons({
      tablerBroadcast,
      tablerPlus,
      tablerRefresh,
      tablerAlertTriangle,
      tablerPlayerPlay,
      tablerArrowBackUp,
      tablerArchive,
      tablerBriefcase,
      tablerCashRegister,
      tablerShoppingCart,
      tablerBuildingSkyscraper,
      tablerBuildingStore,
      tablerMapPin,
      tablerPlugConnected,
    }),
  ],
  templateUrl: './channels-tab.html',
  host: { class: 'flex flex-col gap-10' },
})
export class ChannelsTab {
  private static nextId = 0;
  protected readonly uid = `item-channels-${++ChannelsTab.nextId}`;

  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly conflictDialog = viewChild.required<UnsavedDialog>('conflictDialog');

  readonly itemId = input.required<string>();
  readonly itemStatus = input.required<ItemStatus>();
  readonly companyProfile = input<ItemCompanyProfile | null>(null);
  readonly readonly = input(false);

  readonly forbidden = output<void>();

  protected readonly listingScope = signal<ListingScope>('company');
  protected readonly channels = signal<ListingChannelOption[]>([]);
  protected readonly listings = signal<ChannelListing[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal(false);

  protected readonly selectedChannelId = signal('');
  protected readonly selectedPublicationStatus = signal<ListingStatus>('DRAFT');

  private loadSeq = 0;
  private createKey: string | null = null;
  private lastCreateFingerprint: string | null = null;

  protected readonly tableCols =
    'grid-cols-trade-item-channel-row-actions';
  protected readonly skeletonRows = [1, 2, 3];
  protected readonly statusKey = LISTING_STATUS_KEY;
  protected readonly channelTypeKey = CHANNEL_TYPE_KEY;

  protected readonly companyId = computed(() => this.scopeState.company().id);
  protected readonly branchId = computed(() => this.scopeState.branch().id);
  protected readonly matchedCompanyProfile = computed(() => {
    const profile = this.companyProfile();
    return profile && profile.companyId === this.companyId() ? profile : null;
  });
  protected readonly branchName = computed(() => {
    const branch = this.scopeState.branch();
    return this.language() === 'ar' ? branch.nameAr : branch.nameEn;
  });

  protected readonly activeContext = computed<TradeContext>(() =>
    this.listingScope() === 'branch'
      ? tradeContext(this.scopeState, 'BRANCH')
      : tradeContext(this.scopeState, 'COMPANY'),
  );

  protected readonly scopeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'company', label: this.transloco.translate('itemForm.listing.company') },
      { value: 'branch', label: this.branchName() },
    ];
  });

  protected readonly globalAddReason = computed<string | null>(() => {
    this.i18n();
    const profile = this.matchedCompanyProfile();
    if (!profile) {
      return this.transloco.translate('itemForm.reasons.needProfile');
    }
    if (this.itemStatus() !== 'ACTIVE' || profile.status !== 'ACTIVE') {
      return this.transloco.translate('itemForm.reasons.activateFirst');
    }
    if (!profile.canSell) {
      return this.transloco.translate('itemForm.reasons.needSell');
    }
    return null;
  });

  protected readonly addRowDisabled = computed(
    () => this.readonly() || this.busy() || this.loading() || this.loadFailed() || this.globalAddReason() !== null,
  );

  protected readonly channelById = computed(
    () => new Map(this.channels().map((channel) => [channel.id, channel])),
  );

  protected readonly channelOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const profile = this.matchedCompanyProfile();
    const listedIds = new Set(this.listings().map((l) => l.channelId));
    const isBranch = this.listingScope() === 'branch';

    const options: DropdownOption<string>[] = [];
    for (const channel of this.channels()) {
      let reasonKey: string | null = null;
      if (channel.status !== 'ACTIVE') {
        reasonKey = 'itemForm.reasons.inactive';
      } else if (channel.channelType === 'POS' && !profile?.canPos) {
        reasonKey = 'itemForm.reasons.needPos';
      } else if (isBranch && channel.linkedToBranch === false) {
        reasonKey = 'itemForm.reasons.notLinked';
      } else if (listedIds.has(channel.id)) {
        reasonKey = 'itemForm.reasons.listed';
      }

      const reason = reasonKey ? this.transloco.translate(reasonKey) : null;
      options.push({
        value: channel.id,
        label: reason ? `${channel.name} — ${reason}` : channel.name,
        disabled: reason !== null,
      });
    }
    return options;
  });

  protected readonly publicationOptions = computed<DropdownOption<ListingStatus>[]>(() => {
    this.i18n();
    return [
      { value: 'DRAFT', label: this.transloco.translate(LISTING_STATUS_KEY.DRAFT) },
      { value: 'PUBLISHED', label: this.transloco.translate(LISTING_STATUS_KEY.PUBLISHED) },
    ];
  });

  protected readonly canSubmitAdd = computed(() => {
    if (this.addRowDisabled()) return false;
    const selected = this.selectedChannelId();
    if (!selected) return false;
    const opt = this.channelOptions().find((o) => o.value === selected);
    return Boolean(opt && !opt.disabled);
  });

  constructor() {
    effect(() => {
      const id = this.itemId();
      const ctx = this.activeContext();
      const hasProfile = this.matchedCompanyProfile() !== null;
      untracked(() => void this.loadData(ctx, id, hasProfile));
    });

    effect(() => {
      const options = this.channelOptions();
      const current = this.selectedChannelId();
      const valid = options.some((opt) => opt.value === current && !opt.disabled);
      if (!valid) {
        const firstAvailable = options.find((opt) => !opt.disabled)?.value ?? '';
        if (firstAvailable !== current) {
          this.selectedChannelId.set(firstAvailable);
        }
      }
    });
  }

  protected reload(): void {
    void this.loadData(this.activeContext(), this.itemId(), this.matchedCompanyProfile() !== null);
  }

  protected setListingScope(next: string | null): void {
    const resolved: ListingScope = next === 'branch' ? 'branch' : 'company';
    if (resolved === this.listingScope()) return;
    this.listingScope.set(resolved);
    this.createKey = null;
    this.lastCreateFingerprint = null;
  }

  protected tileFor(listing: ChannelListing): TileSpec {
    const channel = this.channelById().get(listing.channelId);
    return channel ? CHANNEL_TYPE_TILE[channel.channelType] : CHANNEL_TYPE_TILE.INTERNAL_SALES;
  }

  protected channelName(listing: ChannelListing): string {
    return this.channelById().get(listing.channelId)?.name ?? listing.channelId;
  }

  protected channelCode(listing: ChannelListing): string {
    return this.channelById().get(listing.channelId)?.code ?? '';
  }

  protected channelTypeLabel(listing: ChannelListing): string {
    this.i18n();
    const channel = this.channelById().get(listing.channelId);
    return channel ? this.transloco.translate(CHANNEL_TYPE_KEY[channel.channelType]) : '—';
  }

  protected statusBadgeClass(status: ListingStatus): string {
    return LISTING_STATUS_BADGE[status];
  }

  protected updatedText(listing: ChannelListing): string {
    return formatDate(listing.updatedAt, this.language());
  }

  protected menuLabel(listing: ChannelListing): string {
    this.i18n();
    return this.transloco.translate('itemForm.table.listingActions', { name: this.channelName(listing) });
  }

  protected actionsFor(listing: ChannelListing): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [];
    if (listing.publicationStatus !== 'PUBLISHED') {
      items.push({
        id: 'publish',
        title: this.transloco.translate('itemForm.actions.publish'),
        icon: 'tablerPlayerPlay',
        tile: 'bg-icon-green',
      });
    }
    if (listing.publicationStatus !== 'DRAFT') {
      items.push({
        id: 'toDraft',
        title: this.transloco.translate('itemForm.actions.toDraft'),
        icon: 'tablerArrowBackUp',
        tile: 'bg-icon-navy',
      });
    }
    if (listing.publicationStatus !== 'RETIRED') {
      items.push({
        id: 'retire',
        title: this.transloco.translate('itemForm.actions.retire'),
        icon: 'tablerArchive',
        tile: 'bg-icon-gray',
      });
    }
    return items;
  }

  protected async addListing(): Promise<void> {
    if (!this.canSubmitAdd()) return;
    const ctx = this.activeContext();
    const itemId = this.itemId();
    const channelId = this.selectedChannelId();
    const publicationStatus = this.selectedPublicationStatus();
    const body = { channelId, publicationStatus };
    const fingerprint = JSON.stringify({ ctx, itemId, body });
    if (fingerprint !== this.lastCreateFingerprint || !this.createKey) {
      this.lastCreateFingerprint = fingerprint;
      this.createKey = newIdempotencyKey();
    }

    this.busy.set(true);
    try {
      await createListing(ctx, itemId, body, this.createKey);
      this.createKey = null;
      this.lastCreateFingerprint = null;
      const refreshed = await listItemListings(ctx, itemId, 1, 50);
      this.listings.set(refreshed.items);
      this.notify.success(this.transloco.translate('itemForm.toast.listingSaved'));
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.emit();
        return;
      }
      this.notify.error(this.transloco.translate(itemErrorKey(error)));
    } finally {
      this.busy.set(false);
    }
  }

  protected onListingAction(listing: ChannelListing, selection: ActionSelection): void {
    const action = selection.id as ListingActionId;
    const nextStatus: ListingStatus =
      action === 'publish' ? 'PUBLISHED' : action === 'toDraft' ? 'DRAFT' : 'RETIRED';
    void this.updateListingStatus(listing, nextStatus);
  }

  private async updateListingStatus(listing: ChannelListing, nextStatus: ListingStatus): Promise<void> {
    if (this.readonly() || this.busy()) return;
    const ctx = this.activeContext();
    const itemId = this.itemId();
    const action = actionKey('listing', ctx, itemId, listing.channelId, listing.version, nextStatus);

    this.busy.set(true);
    try {
      await patchListing(
        ctx,
        itemId,
        listing.channelId,
        listing.version,
        { publicationStatus: nextStatus },
        action.key,
      );
      action.done();
      const refreshed = await listItemListings(ctx, itemId, 1, 50);
      this.listings.set(refreshed.items);
      this.notify.success(this.transloco.translate('itemForm.toast.listingSaved'));
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.emit();
        return;
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.busy.set(false);
        const choice = await this.conflictDialog().open();
        if (choice === 'cancel') return;
        await this.loadData(ctx, itemId, this.matchedCompanyProfile() !== null);
        if (choice === 'discard') {
          const fresh = this.listings().find((row) => row.channelId === listing.channelId);
          if (fresh) {
            await this.updateListingStatus(fresh, nextStatus);
          }
        }
        return;
      }
      this.notify.error(this.transloco.translate(itemErrorKey(error)));
    } finally {
      this.busy.set(false);
    }
  }

  private async loadData(ctx: TradeContext, itemId: string, hasProfile: boolean): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const [channelsRes, listingsRes] = await Promise.all([
        listListingChannels(ctx),
        hasProfile
          ? listItemListings(ctx, itemId, 1, 50)
          : Promise.resolve({ items: [] as ChannelListing[], total: 0, page: 1, limit: 50 }),
      ]);
      if (seq !== this.loadSeq) return;
      this.channels.set(channelsRes);
      this.listings.set(listingsRes.items);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.channels.set([]);
      this.listings.set([]);
      if (isForbiddenError(error)) {
        this.forbidden.emit();
        return;
      }
      this.loadFailed.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
