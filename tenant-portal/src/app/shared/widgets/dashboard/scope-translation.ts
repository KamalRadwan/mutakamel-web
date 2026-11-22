import { Observable } from 'rxjs';
import { Translation, TranslocoService } from '@jsverse/transloco';

/**
 * Loads a lazy Transloco scope and emits its translation, registering the scope alias first.
 *
 * `selectTranslation(scope)` called from a field initializer can start the scope request before any
 * template pipe has read `provideTranslocoScope` and registered the alias. Transloco then merges
 * the file under the camel-cased scope name (for example `crmWidgetBuilder.*`) and caches that load,
 * so later `builder.*` keys stay raw after in-app navigation. Registering the alias up front makes
 * the merge use the same prefix as the templates on every navigation path.
 */
export function selectScopeTranslation(
  transloco: TranslocoService,
  scope: string,
  alias: string,
): Observable<Translation> {
  transloco._setScopeAlias(scope, alias);
  return transloco.selectTranslation(scope);
}
