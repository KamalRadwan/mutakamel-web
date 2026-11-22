import type { ActivatedRouteSnapshot, CanDeactivateFn } from '@angular/router';
import type { WidgetPage } from './widget-page';

function matchesWidgetRoute(
  root: ActivatedRouteSnapshot,
  routeConfig: ActivatedRouteSnapshot['routeConfig'],
  widgetId: string,
): boolean {
  if (root.routeConfig === routeConfig && root.paramMap.get('id') === widgetId) {
    return true;
  }
  return root.children.some((child) => matchesWidgetRoute(child, routeConfig, widgetId));
}

export const widgetPageCanDeactivate: CanDeactivateFn<WidgetPage> = (
  component,
  currentRoute,
  _currentState,
  nextState,
) => {
  const currentId = currentRoute.paramMap.get('id');
  if (currentId && nextState?.root && matchesWidgetRoute(nextState.root, currentRoute.routeConfig, currentId)) {
    return true;
  }
  return component.canLeave();
};
