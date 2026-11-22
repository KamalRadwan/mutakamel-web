import { Component, computed, inject, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDown,
  tablerArrowUp,
  tablerBox,
  tablerBraces,
  tablerEye,
  tablerEyeOff,
  tablerFileText,
  tablerLayoutBottombar,
  tablerLayoutColumns,
  tablerLayoutNavbar,
  tablerLayoutRows,
  tablerLine,
  tablerLink,
  tablerLock,
  tablerLockOpen,
  tablerMathFunction,
  tablerPhoto,
  tablerSection,
  tablerSeparatorHorizontal,
  tablerSpacingVertical,
  tablerSquare,
  tablerStack2,
  tablerSum,
  tablerTable,
  tablerTableOptions,
  tablerTypography,
} from '@ng-icons/tabler-icons';
import { Button } from '../../../../../../shared/ui/button/button';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import type { TemplateNode, TemplateNodeType } from '../../../templates.model';
import { DesignerState } from '../../designer-state';
import { currentPageRootNodeIds } from '../../document-ops';
import { NODE_TYPE_VISUAL } from '../field-helpers';

interface LayerRow {
  node: TemplateNode;
  depth: number;
  isAbsolute: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

@Component({
  selector: 'app-tpl-layers-modal',
  imports: [NgIcon, TranslocoPipe, Button, Modal],
  providers: [
    provideIcons({
      tablerArrowDown,
      tablerArrowUp,
      tablerBox,
      tablerBraces,
      tablerEye,
      tablerEyeOff,
      tablerFileText,
      tablerLayoutBottombar,
      tablerLayoutColumns,
      tablerLayoutNavbar,
      tablerLayoutRows,
      tablerLine,
      tablerLink,
      tablerLock,
      tablerLockOpen,
      tablerMathFunction,
      tablerPhoto,
      tablerSection,
      tablerSeparatorHorizontal,
      tablerSpacingVertical,
      tablerSquare,
      tablerStack2,
      tablerSum,
      tablerTable,
      tablerTableOptions,
      tablerTypography,
    }),
  ],
  templateUrl: './layers-modal.html',
  host: { class: 'contents' },
})
export class LayersModal {
  protected readonly state = inject(DesignerState);
  private readonly modal = viewChild.required<Modal>('layersModal');

  open(): void {
    if (!this.state.document()) return;
    this.modal().open();
  }

  protected readonly rows = computed<LayerRow[]>(() => {
    const doc = this.state.document();
    if (!doc) return [];

    if (doc.layoutMode === 'FIXED_CANVAS') {
      const result: LayerRow[] = [];
      const seen = new Set<string>();

      const walkAbs = (ids: readonly string[], depth: number) => {
        const siblings = ids
          .map((id, order) => ({ node: doc.nodes[id], order }))
          .filter((entry): entry is { node: TemplateNode; order: number } =>
            Boolean(entry.node && entry.node.layout.kind === 'ABSOLUTE' && !seen.has(entry.node.id)),
          )
          .sort((a, b) => {
            const za = a.node.layout.kind === 'ABSOLUTE' ? a.node.layout.zIndex : 0;
            const zb = b.node.layout.kind === 'ABSOLUTE' ? b.node.layout.zIndex : 0;
            return zb !== za ? zb - za : a.order - b.order;
          })
          .map((entry) => entry.node);

        for (let i = 0; i < siblings.length; i++) {
          const node = siblings[i];
          seen.add(node.id);
          result.push({
            node,
            depth,
            isAbsolute: true,
            canMoveUp: i > 0,
            canMoveDown: i < siblings.length - 1,
          });
          if (node.childIds.length > 0) {
            walkAbs(node.childIds, depth + 1);
          }
        }
      };

      walkAbs(currentPageRootNodeIds(doc, this.state.pageIndex()), 0);
      return result;
    }

    const result: LayerRow[] = [];
    const seen = new Set<string>();

    const walk = (ids: readonly string[], depth: number) => {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (seen.has(id)) continue;
        const node = doc.nodes[id];
        if (!node) continue;
        seen.add(id);
        const isFlow = node.layout.kind === 'FLOW';
        result.push({
          node,
          depth,
          isAbsolute: !isFlow,
          canMoveUp: isFlow && i > 0,
          canMoveDown: isFlow && i < ids.length - 1,
        });
        if (node.childIds.length > 0) {
          walk(node.childIds, depth + 1);
        }
      }
    };

    walk(currentPageRootNodeIds(doc, this.state.pageIndex()), 0);
    return result;
  });

  protected visualFor(type: TemplateNodeType): { icon: string; tile: string } {
    return NODE_TYPE_VISUAL[type];
  }

  protected isSelected(id: string): boolean {
    return this.state.selectedIds().includes(id);
  }

  protected selectRow(id: string): void {
    this.state.select([id], 'replace');
  }

  protected toggleHidden(event: Event, node: TemplateNode): void {
    event.stopPropagation();
    if (this.state.readOnly()) return;
    this.state.updateNode(node.id, { hidden: !node.hidden }, 'toggleHidden');
  }

  protected toggleLocked(event: Event, node: TemplateNode): void {
    event.stopPropagation();
    if (this.state.readOnly()) return;
    this.state.updateNode(node.id, { locked: !node.locked }, 'toggleLock');
  }

  protected moveUp(event: Event, row: LayerRow): void {
    event.stopPropagation();
    if (this.state.readOnly() || row.node.locked || !row.canMoveUp) return;
    if (row.isAbsolute) {
      this.reorderAbsoluteSibling(row.node, 'FORWARD');
    } else {
      this.state.moveInFlow(row.node.id, -1);
    }
  }

  protected moveDown(event: Event, row: LayerRow): void {
    event.stopPropagation();
    if (this.state.readOnly() || row.node.locked || !row.canMoveDown) return;
    if (row.isAbsolute) {
      this.reorderAbsoluteSibling(row.node, 'BACKWARD');
    } else {
      this.state.moveInFlow(row.node.id, 1);
    }
  }

  private reorderAbsoluteSibling(node: TemplateNode, dir: 'FORWARD' | 'BACKWARD'): void {
    const pageIdx = this.state.pageIndex();
    this.state.apply('arrange', (doc) => {
      const target = doc.nodes[node.id];
      if (!target || target.locked || target.layout.kind !== 'ABSOLUTE') return;

      const siblingIds = target.parentId
        ? (doc.nodes[target.parentId]?.childIds ?? [])
        : currentPageRootNodeIds(doc, pageIdx);

      const ordered = siblingIds
        .map((id, order) => ({ id, n: doc.nodes[id], order }))
        .filter((e): e is { id: string; n: TemplateNode; order: number } =>
          Boolean(e.n && e.n.layout.kind === 'ABSOLUTE'),
        )
        .sort((a, b) => {
          const za = a.n.layout.kind === 'ABSOLUTE' ? a.n.layout.zIndex : 0;
          const zb = b.n.layout.kind === 'ABSOLUTE' ? b.n.layout.zIndex : 0;
          return za !== zb ? za - zb : a.order - b.order;
        })
        .map((e) => e.id);

      const idx = ordered.indexOf(target.id);
      const swapIdx = dir === 'FORWARD' ? idx + 1 : idx - 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;

      [ordered[idx], ordered[swapIdx]] = [ordered[swapIdx], ordered[idx]];
      ordered.forEach((id, pos) => {
        const sibling = doc.nodes[id];
        if (sibling && sibling.layout.kind === 'ABSOLUTE') {
          sibling.layout.zIndex = Math.max(0, Math.min(1000, pos + 1));
        }
      });
    });
  }

  protected close(): void {
    this.modal().close();
  }
}
