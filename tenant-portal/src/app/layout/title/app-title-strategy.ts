import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { APP_MAP, AppId, PAGES } from '../navigation';

const BRAND_FALLBACK = 'Mutakamel';
const SEPARATOR = ' · ';

/**
 * Title keys for a URL, most specific first: nav.pages.<app>.<feature>.<page>, then the feature
 * (detail pages such as /crm/leads/:id fall back to it), then the app. Home is nav.features.home.
 */
export function titleKeysFor(url: string): string[] {
  const segments = url.split(/[?#(;]/)[0].split('/').filter(Boolean);
  const [app, feature, page] = segments;
  if (segments.length === 0 || (segments.length === 1 && app === 'workspace')) return ['nav.features.home'];
  const definition = APP_MAP.get(app as AppId);
  if (!definition) return [];
  const keys: string[] = [];
  if (feature !== undefined && definition.features.includes(feature)) {
    if (page !== undefined && (PAGES[`${app}/${feature}`] ?? []).some((item) => item.id === page)) {
      keys.push(`nav.pages.${app}.${feature}.${page}`);
    }
    keys.push(`nav.features.${feature}`);
  }
  keys.push(`nav.apps.${app}`);
  return keys;
}

/**
 * Browser tab title "<page title> · <brand>" from the route's nav key (or a route `title`, read as an
 * i18n key), re-applied when the language or its translation file changes. Pages without a key show
 * the brand only.
 */
@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);
  private keys: string[] = [];

  constructor() {
    super();
    // Follows the active language and loads its root translation, so the title is re-applied on change.
    this.transloco
      .selectTranslation()
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.apply());
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const routeTitle = this.buildTitle(snapshot);
    this.keys = [...(routeTitle ? [routeTitle] : []), ...titleKeysFor(snapshot.url)];
    this.apply();
  }

  private apply(): void {
    const brand = this.resolve('brand') ?? BRAND_FALLBACK;
    const page = this.keys.map((key) => this.resolve(key)).find((value) => value !== undefined);
    this.title.setTitle(page ? `${page}${SEPARATOR}${brand}` : brand);
  }

  /** Reads the loaded root translation directly, so a missing key or a not-yet-loaded file is undefined. */
  private resolve(key: string): string | undefined {
    const value: unknown = this.transloco.getTranslation(this.transloco.getActiveLang())?.[key];
    return typeof value === 'string' && value !== '' ? value : undefined;
  }
}
