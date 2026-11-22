import { Component, ElementRef, computed, effect, inject, linkedSignal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, PRIMARY_OUTLET, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBuilding,
  tablerCalculator,
  tablerAdjustmentsHorizontal,
  tablerChartBar,
  tablerChecklist,
  tablerCopy,
  tablerDatabase,
  tablerDeviceDesktop,
  tablerDots,
  tablerHierarchy2,
  tablerLayoutDashboard,
  tablerLayoutRows,
  tablerListCheck,
  tablerListNumbers,
  tablerMail,
  tablerTag,
  tablerTrendingUp,
  tablerLayoutGrid,
  tablerLogout,
  tablerSettings,
  tablerShoppingCart,
  tablerTarget,
  tablerUserPlus,
  tablerUsers,
  tablerZoom,
  tablerZoomIn,
  tablerZoomOut,
  tablerAddressBook,
  tablerBell,
  tablerBox,
  tablerBuildingBank,
  tablerBuildingCommunity,
  tablerBuildingWarehouse,
  tablerCashBanknote,
  tablerFileDescription,
  tablerFileInvoice,
  tablerHistory,
  tablerHome,
  tablerChartDots3,
  tablerBellRinging,
  tablerCalendarTime,
  tablerFileDownload,
  tablerTargetArrow,
  tablerClockCheck,
  tablerCalendar,
  tablerActivityHeartbeat,
  tablerListTree,
  tablerLock,
  tablerNotebook,
  tablerPackage,
  tablerPercentage,
  tablerReceipt,
  tablerReceipt2,
  tablerShieldLock,
  tablerTemplate,
  tablerWorld,
  tablerApps,
  tablerArmchair,
  tablerBuildingSkyscraper,
  tablerBuildingStore,
  tablerCoins,
  tablerCreditCard,
  tablerHash,
  tablerKey,
  tablerPalette,
  tablerPhoto,
  tablerPuzzle,
  tablerRepeat,
  tablerRoute,
  tablerSettings2,
  tablerSitemap,
  tablerUser,
  tablerUserCircle,
  tablerUsersGroup,
  tablerAntenna,
  tablerArrowsExchange,
  tablerBarcode,
  tablerBook,
  tablerBroadcast,
  tablerBuildingBroadcastTower,
  tablerCalendarStats,
  tablerClipboardCheck,
  tablerFileSearch,
  tablerFileSettings,
  tablerFileText,
  tablerGavel,
  tablerGitBranch,
  tablerHeartHandshake,
  tablerRuler,
  tablerShieldCheck,
  tablerStack2,
  tablerTable,
  tablerTruck,
  tablerUpload,
  tablerWebhook, tablerPhone } from '@ng-icons/tabler-icons';
import { filter, map } from 'rxjs';
import { AuthSession } from '../../core/auth/auth-session';
import { CurrentUser } from '../../core/auth/current-user';
import { ViewScale } from '../../core/view/view-scale';
import { FullState } from '../../shared/ui/full-state/full-state';
import { Menu, MenuItem } from '../../shared/ui/menu/menu';
import { overflowFit } from '../../shared/ui/overflow/overflow-fit';
import { Preferences } from '../../shared/ui/preferences/preferences';
import { BulkJobApp, BulkJobsTracker } from '../../shared/bulk-jobs';
import { BulkJobsIndicator } from '../bulk-jobs-indicator/bulk-jobs-indicator';
import { NotificationBell } from '../notification-bell/notification-bell';
import { ScopeSwitcher } from '../scope-switcher/scope-switcher';
import { CrmModules } from '../../features/crm/shared/crm-modules/crm-modules';
import { OverCapacityNotice } from '../../features/workspace/seats/over-capacity/over-capacity-notice.service';
import { SeatNoticeHost } from '../../features/workspace/seats/over-capacity/seat-notice-host/seat-notice-host';
import { PhoneState } from '../../core/phone/phone';
import { PhoneHost } from '../phone/phone-host/phone-host';
import { APP_MAP, APPS, AppId, CRM_FEATURE_MODULE, FEATURE_ICONS, NAV_GROUPS, PAGES } from '../navigation';
import { StaffAccessPage } from '../../features/workspace/staff/staff-access-page';
import { STAFF_PAGES } from '../../features/workspace/staff/staff-navigation';
import { StaffReadAccess, staffScopeQuery } from '../../features/workspace/staff/staff-read-access';

const BULK_JOB_APPS = new Set<BulkJobApp>(['core', 'crm', 'trading', 'accounting']);

@Component({
  selector: 'app-layout',
  imports: [RouterLink, RouterOutlet, TranslocoPipe, NgIcon, FullState, Menu, Preferences, BulkJobsIndicator, NotificationBell, ScopeSwitcher, SeatNoticeHost, PhoneHost, StaffAccessPage],
  providers: [
    provideIcons({
      tablerWorld,
      tablerPhone,
      tablerAddressBook,
      tablerBell,
      tablerBox,
      tablerBuildingBank,
      tablerBuildingCommunity,
      tablerBuildingWarehouse,
      tablerCashBanknote,
      tablerFileDescription,
      tablerFileInvoice,
      tablerHistory,
      tablerHome,
      tablerChartDots3,
      tablerBellRinging,
      tablerCalendarTime,
      tablerFileDownload,
      tablerTargetArrow,
      tablerClockCheck,
      tablerCalendar,
      tablerActivityHeartbeat,
      tablerListTree,
      tablerLock,
      tablerNotebook,
      tablerPackage,
      tablerPercentage,
      tablerReceipt,
      tablerReceipt2,
      tablerShieldLock,
      tablerTemplate,
      tablerLayoutGrid,
      tablerDots,
      tablerListNumbers,
      tablerHierarchy2,
      tablerLayoutRows,
      tablerTrendingUp,
      tablerTag,
      tablerAdjustmentsHorizontal,
      tablerMail,
      tablerDatabase,
      tablerLayoutDashboard,
      tablerUserPlus,
      tablerTarget,
      tablerChartBar,
      tablerBuilding,
      tablerUsers,
      tablerShoppingCart,
      tablerCalculator,
      tablerSettings,
      tablerChecklist,
      tablerLogout,
      tablerZoom,
      tablerZoomIn,
      tablerZoomOut,
      tablerDeviceDesktop,
      tablerApps,
      tablerArmchair,
      tablerBuildingSkyscraper,
      tablerBuildingStore,
      tablerCoins,
      tablerCreditCard,
      tablerHash,
      tablerKey,
      tablerPalette,
      tablerPhoto,
      tablerPuzzle,
      tablerRepeat,
      tablerRoute,
      tablerSettings2,
      tablerSitemap,
      tablerUser,
      tablerUserCircle,
      tablerUsersGroup,
      tablerAntenna,
      tablerArrowsExchange,
      tablerBarcode,
      tablerBook,
      tablerBroadcast,
      tablerBuildingBroadcastTower,
      tablerCalendarStats,
      tablerClipboardCheck,
      tablerFileSearch,
      tablerFileSettings,
      tablerFileText,
      tablerGavel,
      tablerGitBranch,
      tablerHeartHandshake,
      tablerRuler,
      tablerShieldCheck,
      tablerStack2,
      tablerTable,
      tablerTruck,
      tablerUpload,
      tablerWebhook,
      tablerCopy,
      tablerListCheck,
    }),
  ],
  templateUrl: './app-layout.html',
})
export class AppLayout {
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly viewScale = inject(ViewScale);
  private readonly bulkJobs = inject(BulkJobsTracker);
  private readonly crmModules = inject(CrmModules);
  private readonly staffRead = inject(StaffReadAccess);
  protected readonly phone = inject(PhoneState);
  protected readonly authSession = inject(AuthSession);
  protected readonly currentUser = inject(CurrentUser);
  protected readonly identityReady = computed(() => this.authSession.status() === 'signed-in' && this.authSession.me() !== null);
  private readonly skipReportOnce = new Set<string>();

  private readonly translation = toSignal(this.transloco.selectTranslation());
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  private readonly segments = computed(() => this.url().split(/[?#]/)[0].split('/').filter(Boolean));

  private readonly staffLocation = computed(() => {
    const tree = this.router.parseUrl(this.url());
    const [app, feature, page] = tree.root.children[PRIMARY_OUTLET]?.segments ?? [];
    return app?.path === 'workspace' && feature?.path === 'staff'
      ? { page: page?.path, query: tree.queryParamMap }
      : null;
  });

  private readonly staffEntryPages = computed(() => this.staffRead.availablePages());

  protected readonly staffPageQuery = computed(() => {
    const location = this.staffLocation();
    return location ? staffScopeQuery(location.query) : null;
  });

  protected readonly staffOutlet = computed(() => {
    const location = this.staffLocation();
    if (!location) return 'open';
    if (!this.staffRead.ready()) return 'pending';
    const page = location.page;
    return page && STAFF_PAGES.some(({ id }) => id === page) && !this.staffRead.allows(page, location.query)
      ? 'denied' : 'open';
  });

  private readonly subNav = viewChild<ElementRef<HTMLElement>>('subNav');

  constructor() {
    inject(OverCapacityNotice).start();
    void this.crmModules.ensureLoaded();

    effect(() => {
      const url = this.url();
      untracked(() => this.handleBulkJobQueryParams(url));
    });

    effect(() => {
      const leadsOn = this.crmModules.leadsEnabled();
      const oppsOn = this.crmModules.opportunitiesEnabled();
      const [app, feature] = this.segments();
      if (app !== 'crm') return;
      if (feature === 'leads' && !leadsOn) {
        untracked(() => void this.router.navigateByUrl('/crm/off/leads'));
      } else if (feature === 'opportunities' && !oppsOn) {
        untracked(() => void this.router.navigateByUrl('/crm/off/opportunities'));
      }
    });
  }

  private handleBulkJobQueryParams(url: string): void {
    const tree = this.router.parseUrl(url);
    const bulkJob = tree.queryParams['bulkJob'];
    const bulkApp = tree.queryParams['bulkApp'];
    if (typeof bulkJob !== 'string' || !bulkJob || typeof bulkApp !== 'string' || !BULK_JOB_APPS.has(bulkApp as BulkJobApp)) {
      this.skipReportOnce.clear();
      return;
    }

    const key = `${bulkApp}:${bulkJob}`;
    if (tree.queryParams['select'] === 'failed') {
      this.skipReportOnce.add(key);
      return;
    }

    if (!this.skipReportOnce.delete(key)) {
      this.bulkJobs.openReport(bulkApp as BulkJobApp, bulkJob);
    }

    delete tree.queryParams['bulkJob'];
    delete tree.queryParams['bulkApp'];
    void this.router.navigateByUrl(tree, { replaceUrl: true });
  }

  protected readonly currentApp = computed<AppId>(() => {
    const first = this.segments()[0] as AppId | undefined;
    return first && APP_MAP.has(first) ? first : 'workspace';
  });

  protected readonly currentFeature = computed(() => {
    const segments = this.segments();
    const isHome = segments.length === 0 || (segments.length === 1 && segments[0] === 'workspace');
    return segments[1] ?? (isHome ? 'home' : '');
  });

  /** The app whose features the main nav shows. Picking an app changes only the nav; the page stays. Reset on every navigation. */
  protected readonly navApp = linkedSignal<string, AppId>({ source: this.url, computation: () => this.currentApp() });

  protected readonly features = computed(() => {
    const app = this.navApp();
    const list = APP_MAP.get(app)?.features ?? [];
    if (app === 'workspace' && this.staffEntryPages().length === 0) {
      return list.filter((feature) => feature !== 'staff');
    }
    if (app !== 'crm') return list;
    const leadsOn = this.crmModules.leadsEnabled();
    const oppsOn = this.crmModules.opportunitiesEnabled();
    return list.filter((feature) => {
      const mod = CRM_FEATURE_MODULE[feature];
      if (mod === 'leads') return leadsOn;
      if (mod === 'opportunities') return oppsOn;
      return true;
    });
  });

  /** A feature is shown as active only while the nav shows the app of the current page. */
  protected isActiveFeature(feature: string): boolean {
    return this.navApp() === this.currentApp() && feature === this.currentFeature();
  }

  private readonly mainNav = viewChild<ElementRef<HTMLElement>>('mainNav');
  protected readonly visibleFeatures = overflowFit(
    this.mainNav,
    computed(() => [this.features(), this.translation(), this.navApp() === this.currentApp() && this.currentFeature()]),
  );

  /** A group section opens its first page; its pages are in the level-2 bar (owner 2026-11-21: no dropdowns). */
  protected featureLink(feature: string): string[] {
    if (this.navApp() === 'workspace' && feature === 'staff') {
      const first = this.staffEntryPages()[0]?.id;
      return first ? ['/', 'workspace', 'staff', first] : ['/', 'workspace', 'staff'];
    }
    const first = this.isGroupFeature(feature) ? PAGES[`${this.navApp()}/${feature}`]?.[0]?.id : undefined;
    return first ? ['/', this.navApp(), feature, first] : ['/', this.navApp(), feature];
  }

  protected isGroupFeature(feature: string): boolean {
    return NAV_GROUPS.has(`${this.navApp()}/${feature}`);
  }

  protected featureCurrent(feature: string): 'page' | 'true' | null {
    if (!this.isActiveFeature(feature)) return null;
    const pages = this.pages();
    return pages.length > 0 && this.currentPage() !== pages[0]?.id ? 'true' : 'page';
  }

  protected readonly moreItems = computed<MenuItem[]>(() => {
    this.translation();
    return this.features()
      .slice(this.visibleFeatures())
      .map((feature) => ({
        id: feature,
        label: this.transloco.translate(`nav.features.${feature}`),
        icon: this.iconOf(feature)?.icon,
        tile: this.iconOf(feature)?.tile,
        selected: this.isActiveFeature(feature),
      }));
  });

  protected readonly moreHasActive = computed(() => this.moreItems().some((item) => item.selected));

  protected selectFeature(target: string) {
    void this.router.navigate(target.includes('/') ? ['/', this.navApp(), ...target.split('/')] : this.featureLink(target));
  }

  protected readonly pages = computed(() => {
    const key = `${this.currentApp()}/${this.currentFeature()}`;
    if (key === 'workspace/staff') return this.staffRead.availablePages(this.staffLocation()?.query);
    const list = PAGES[key] ?? [];
    if (key !== 'crm/settings') return list;
    const leadsOn = this.crmModules.leadsAnywhere();
    const oppsOn = this.crmModules.opportunitiesAnywhere();
    return list.filter((page) => {
      if (page.module === 'leads') return leadsOn;
      if (page.module === 'opportunities') return oppsOn;
      return true;
    });
  });

  protected readonly currentPage = computed(() => this.segments()[2] ?? this.pages()[0]?.id);

  /** Level-2 items that do not fit collapse into a "More" menu, like the main nav (no clipped items). */
  protected readonly visibleSubPages = overflowFit(
    this.subNav,
    computed(() => [this.pages(), this.translation(), this.currentApp(), this.currentFeature()]),
  );

  protected readonly subMoreItems = computed<MenuItem[]>(() => {
    this.translation();
    const app = this.currentApp();
    const feature = this.currentFeature();
    const current = this.currentPage();
    return this.pages()
      .slice(this.visibleSubPages())
      .map((page) => ({
        id: page.id,
        label: this.transloco.translate(`nav.pages.${app}.${feature}.${page.id}`),
        icon: page.icon,
        selected: page.id === current,
      }));
  });

  protected readonly subMoreHasActive = computed(() => this.subMoreItems().some((item) => item.selected));

  protected selectSubPage(pageId: string) {
    this.navApp.set(this.currentApp());
    void this.router.navigate(['/', this.currentApp(), this.currentFeature(), pageId], {
      queryParams: this.staffPageQuery(),
    });
  }

  protected iconOf(feature: string) {
    return FEATURE_ICONS[`${this.navApp()}/${feature}`];
  }

  protected readonly appItems = computed<MenuItem[]>(() => {
    this.translation();
    const activeApp = this.navApp();
    return APPS.map((app) => ({
      id: app.id,
      label: this.transloco.translate(`nav.apps.${app.id}`),
      icon: app.icon,
      tile: app.tile,
      selected: app.id === activeApp,
    }));
  });

  protected readonly userItems = computed<MenuItem[]>(() => {
    this.translation();
    const view = this.viewScale.size();
    return [
      { id: 'preferences', label: this.transloco.translate('nav.user.preferences'), icon: 'tablerSettings' },
      { id: 'activities', label: this.transloco.translate('nav.user.activities'), icon: 'tablerChecklist' },
      {
        id: 'view',
        label: this.transloco.translate('view.title'),
        icon: 'tablerZoom',
        children: [
          { id: 'auto', label: this.transloco.translate('view.auto'), icon: 'tablerDeviceDesktop', selected: view === 'auto' },
          { id: 'small', label: this.transloco.translate('view.small'), icon: 'tablerZoomOut', selected: view === 'small' },
          { id: 'balanced', label: this.transloco.translate('view.balanced'), icon: 'tablerZoom', selected: view === 'balanced' },
          { id: 'large', label: this.transloco.translate('view.large'), icon: 'tablerZoomIn', selected: view === 'large' },
        ],
      },
      { id: 'logout', label: this.transloco.translate('nav.user.logout'), icon: 'tablerLogout', danger: true, divider: true },
    ];
  });

  protected selectApp(appId: string) {
    if (APP_MAP.has(appId as AppId)) this.navApp.set(appId as AppId);
  }

  protected selectUserAction(actionId: string) {
    if (!this.identityReady()) return;

    if (actionId === 'preferences') {
      this.navApp.set(this.currentApp());
      void this.router.navigate(['/workspace/account/preferences']);
    } else if (actionId === 'activities') {
      this.navApp.set(this.currentApp());
      void this.router.navigate(['/workspace/operations/activities']);
    } else if (actionId === 'auto' || actionId === 'small' || actionId === 'balanced' || actionId === 'large') {
      this.viewScale.set(actionId);
    } else if (actionId === 'logout') {
      this.navApp.set(this.currentApp());
      void this.authSession.logout();
    }
  }

  /** Retry after a failed bootstrap; a retry that finds the session over goes to /login?returnUrl. */
  protected async retrySession(): Promise<void> {
    if (this.authSession.status() !== 'failed') return;
    const status = await this.authSession.ensureLoaded();
    if (status === 'signed-out') await this.authSession.sessionEnded(this.router.url);
  }
}
