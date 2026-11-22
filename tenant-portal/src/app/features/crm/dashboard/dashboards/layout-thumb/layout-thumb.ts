import { Component, computed, input } from '@angular/core';
import type { Visualization } from '../../../../../shared/ui/chart/chart.model';
import type { DashboardDetail } from '../dashboards.model';

const KPI_KINDS = new Set<Visualization>(['METRIC_CARD', 'MULTI_KPI', 'PROGRESS_CARD']);
const MIN_THUMB_ROWS = 24;

interface ThumbRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kpi: boolean;
}

interface ThumbLayout {
  viewBox: string;
  rects: ThumbRect[];
}

@Component({
  selector: 'app-layout-thumb',
  templateUrl: './layout-thumb.html',
  host: {
    class: 'block w-full',
    'aria-hidden': 'true',
  },
})
export class LayoutThumb {
  readonly detail = input<DashboardDetail | null>(null);

  protected readonly layout = computed<ThumbLayout | null>(() => {
    const current = this.detail();
    if (!current) return null;

    const desktopLayout = current.layouts['desktop'] ?? Object.values(current.layouts)[0];
    const items = (desktopLayout?.items ?? []).filter((item) => !item.isHidden && item.w > 0 && item.h > 0);
    const kindByPlacement = new Map<string, Visualization>(
      current.placements.map((placement) => [placement.id, placement.widget.visualizationType]),
    );

    const maxY = items.reduce((acc, item) => Math.max(acc, item.y + item.h), MIN_THUMB_ROWS);
    const rects: ThumbRect[] = items.map((item) => {
      const kind = kindByPlacement.get(item.placementId);
      return {
        id: item.placementId,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        kpi: kind !== undefined && KPI_KINDS.has(kind),
      };
    });

    return {
      viewBox: `0 0 48 ${maxY}`,
      rects,
    };
  });
}
