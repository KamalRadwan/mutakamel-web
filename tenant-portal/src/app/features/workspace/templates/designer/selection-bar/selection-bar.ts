import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerArrowDown,
  tablerArrowUp,
  tablerBox,
  tablerBraces,
  tablerCircleX,
  tablerClick,
  tablerCopy,
  tablerEyeOff,
  tablerLayoutAlignBottom,
  tablerLayoutAlignCenter,
  tablerLayoutAlignLeft,
  tablerLayoutAlignMiddle,
  tablerLayoutAlignRight,
  tablerLayoutAlignTop,
  tablerLine,
  tablerLink,
  tablerLock,
  tablerLockOpen,
  tablerMathFunction,
  tablerPhoto,
  tablerRotateClockwise,
  tablerStack2,
  tablerSum,
  tablerTable,
  tablerTrash,
  tablerTypography,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { moveNodeToPosition, positionError, printableBox, type PositionMode } from '../hybrid-ops';
import { rootZoom } from '../../../../../shared/ui/overlay/zoom';
import { pxToMm } from '../geometry';
import { nodeZone } from '../hybrid-geometry';
import type { TemplateNode, TemplateNodeType } from '../../templates.model';
import { DesignerState } from '../designer-state';

type FrameProp = 'x' | 'y' | 'width' | 'height' | 'rotationDeg';

interface FrameRule {
  min: number;
  max: number;
  decimals: boolean;
}

const FRAME_RULES: Record<FrameProp, FrameRule> = {
  x: { min: 0, max: 500, decimals: true },
  y: { min: 0, max: 1000, decimals: true },
  width: { min: 0.001, max: 500, decimals: true },
  height: { min: 0.001, max: 1000, decimals: true },
  rotationDeg: { min: -180, max: 180, decimals: false },
};

interface NodeVisual {
  icon: string;
  tile: string;
}

function visualForNodeType(type: TemplateNodeType): NodeVisual {
  switch (type) {
    case 'text':
    case 'richText':
      return { icon: 'tablerTypography', tile: 'bg-icon-navy' };
    case 'dataField':
      return { icon: 'tablerBraces', tile: 'bg-icon-blue' };
    case 'image':
      return { icon: 'tablerPhoto', tile: 'bg-icon-violet' };
    case 'staticTable':
    case 'dynamicTable':
    case 'totals':
      return { icon: 'tablerTable', tile: 'bg-icon-teal' };
    case 'formula':
      return { icon: 'tablerMathFunction', tile: 'bg-icon-orange' };
    case 'divider':
      return { icon: 'tablerLine', tile: 'bg-icon-gray' };
    case 'link':
      return { icon: 'tablerLink', tile: 'bg-icon-gray' };
    case 'button':
      return { icon: 'tablerClick', tile: 'bg-icon-gray' };
    default:
      return { icon: 'tablerBox', tile: 'bg-icon-gray' };
  }
}

function formatMmValue(value: number): string {
  return value.toFixed(1);
}

function formatRotationValue(value: number): string {
  return String(Math.round(value));
}

function normalizeNumericInput(raw: string): string {
  return raw
    .trim()
    .replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/[٫,]/g, '.')
    .replace(/−/g, '-');
}

@Component({
  selector: 'app-tpl-selection-bar',
  imports: [NgIcon, TranslocoPipe, Button, Field, Dropdown],
  providers: [
    provideIcons({
      tablerTypography,
      tablerBraces,
      tablerPhoto,
      tablerTable,
      tablerSum,
      tablerMathFunction,
      tablerLine,
      tablerLink,
      tablerClick,
      tablerBox,
      tablerStack2,
      tablerRotateClockwise,
      tablerLock,
      tablerLockOpen,
      tablerArrowUp,
      tablerArrowDown,
      tablerAdjustmentsHorizontal,
      tablerEyeOff,
      tablerCopy,
      tablerTrash,
      tablerCircleX,
      tablerLayoutAlignLeft,
      tablerLayoutAlignCenter,
      tablerLayoutAlignRight,
      tablerLayoutAlignTop,
      tablerLayoutAlignMiddle,
      tablerLayoutAlignBottom,
    }),
  ],
  templateUrl: './selection-bar.html',
})
export class SelectionBar {
  protected readonly position = computed<PositionMode>(() => {
    const node = this.singleNode();
    const doc = this.state.document();
    return doc && node ? (nodeZone(doc, node.id)?.type ?? 'FLOW') : 'FLOW';
  });
  protected readonly positionOptions = computed<DropdownOption<PositionMode>[]>(() => {
    this.language();
    this.i18n();
    const doc = this.state.document(),
      node = this.singleNode();
    return (['FLOW', 'header', 'footer'] as const).map((mode) => {
      const reason = doc && node ? positionError(doc, node, mode) : 'positionUnavailable';
      return {
        value: mode,
        label: this.transloco.translate(`tplDesigner.hybrid.position.${mode}`),
        disabled: reason !== null,
        title: this.transloco.translate(`tplDesigner.hybrid.${reason ?? 'positionHint'}`),
      };
    });
  });
  protected readonly positionHint = computed(() => {
    const doc = this.state.document(),
      node = this.singleNode();
    const reason = doc && node ? positionError(doc, node, this.position()) : null;
    return this.transloco.translate(`tplDesigner.hybrid.${reason ?? 'positionHint'}`);
  });
  protected changePosition(mode: PositionMode): void {
    const node = this.singleNode(),
      doc = this.state.document();
    if (!node || !doc || mode === this.position()) return;
    const el = document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(node.id)}"]`);
    const rect = el?.getBoundingClientRect();
    const zoom = this.state.zoom();
    const width = rect ? pxToMm(rect.width / rootZoom(), zoom) : printableBox(doc).width;
    const height = rect ? pxToMm(rect.height / rootZoom(), zoom) : 0;
    this.state.pendingPlacement.set(null);
    this.state.apply('changePosition', (next) => {
      moveNodeToPosition(next, node.id, mode, { x: 0, y: 0, width, height });
    });
  }
  private static nextId = 0;
  protected readonly uid = `tpl-sel-bar-${++SelectionBar.nextId}`;

  protected readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);

  protected readonly selectedNodes = this.state.selectedNodes;
  protected readonly singleNode = computed<TemplateNode | null>(() => {
    const nodes = this.selectedNodes();
    return nodes.length === 1 ? nodes[0] : null;
  });

  protected readonly singleVisual = computed<NodeVisual>(() => {
    const node = this.singleNode();
    return node ? visualForNodeType(node.type) : { icon: 'tablerBox', tile: 'bg-icon-gray' };
  });

  protected readonly singleName = computed(() => {
    this.language();
    this.i18n();
    const node = this.singleNode();
    return node ? this.state.nodeDisplayName(node) : '';
  });

  protected readonly draftX = signal('0.0');
  protected readonly draftY = signal('0.0');
  protected readonly draftW = signal('0.0');
  protected readonly draftH = signal('0.0');
  protected readonly draftRot = signal('0');
  protected readonly invalidField = signal<FrameProp | null>(null);
  protected readonly frameError = signal<string | null>(null);

  protected readonly flowSiblingsState = computed(() => {
    const doc = this.state.document();
    const node = this.singleNode();
    if (!doc || !node || node.layout.kind !== 'FLOW') {
      return { canUp: false, canDown: false };
    }
    const list = node.parentId ? doc.nodes[node.parentId]?.childIds : doc.rootNodeIds;
    if (!list) return { canUp: false, canDown: false };
    const idx = list.indexOf(node.id);
    return {
      canUp: !node.locked && idx > 0,
      canDown: !node.locked && idx >= 0 && idx < list.length - 1,
    };
  });

  protected readonly typeAction = computed<{ kind: string; icon: string; labelKey: string } | null>(
    () => {
    const node = this.singleNode();
    if (!node) return null;
    switch (node.type) {
      case 'image':
        return { kind: 'replaceImage', icon: 'tablerPhoto', labelKey: 'tplTools.bar.replaceImage',
          };
      case 'text':
      case 'richText':
        return { kind: 'editTextContent', icon: 'tablerTypography', labelKey: 'tplTools.bar.editText',
          };
      case 'dataField':
        return { kind: 'editBinding', icon: 'tablerBraces', labelKey: 'tplTools.bar.fieldSettings',
          };
      case 'staticTable':
      case 'dynamicTable':
        return { kind: 'openTableSettings', icon: 'tablerTable', labelKey: 'tplTools.bar.tableSettings',
          };
      case 'formula':
        return { kind: 'editFormula', icon: 'tablerMathFunction', labelKey: 'tplTools.bar.editFormula',
          };
      case 'totals':
        return { kind: 'openTotals', icon: 'tablerSum', labelKey: 'tplTools.bar.totalsSettings' };
      case 'link':
      case 'button':
        return { kind: 'editLink', icon: 'tablerLink', labelKey: 'tplTools.bar.editLink' };
      default:
        return null;
    }
    },
  );

  protected readonly hasAbsoluteInMulti = computed(() =>
    this.selectedNodes().some((n) => n.layout.kind === 'ABSOLUTE'),
  );

  protected readonly hasUnlockedAbsoluteInMulti = computed(() =>
    this.selectedNodes().some((n) => !n.locked && n.layout.kind === 'ABSOLUTE'),
  );

  protected readonly allSelectedLocked = computed(() => {
    const nodes = this.selectedNodes();
    return nodes.length > 0 && nodes.every((n) => n.locked);
  });

  constructor() {
    effect(() => {
      const node = this.singleNode();
      untracked(() => this.syncDraftsFromNode(node));
    });
  }

  protected onFrameInput(prop: FrameProp, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.setDraft(prop, value);
    if (this.invalidField() === prop) {
      this.invalidField.set(null);
      this.frameError.set(null);
    }
  }

  protected commitFrame(prop: FrameProp, event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    const node = this.singleNode();
    if (!node || node.locked || this.state.readOnly() || node.layout.kind !== 'ABSOLUTE') return;

    const raw = normalizeNumericInput(this.getDraft(prop));
    const rule = FRAME_RULES[prop];
    const parsed = raw === '' ? Number.NaN : Number(raw);

    if (!Number.isFinite(parsed) || parsed < rule.min || parsed > rule.max) {
      this.invalidField.set(prop);
      this.frameError.set(
        this.transloco.translate('tplTools.bar.outOfRange', { min: rule.min, max: rule.max }),
      );
      return;
    }

    if (!rule.decimals && !Number.isInteger(parsed)) {
      this.invalidField.set(prop);
      this.frameError.set(
        this.transloco.translate('tplTools.bar.wholeNumber', { min: rule.min, max: rule.max }),
      );
      return;
    }

    this.invalidField.set(null);
    this.frameError.set(null);

    const current = node.layout[prop];
    if (Math.abs(parsed - current) > 1e-6) {
      this.state.updateFrame([node.id], { [prop]: parsed });
      const updated = this.state.document()?.nodes[node.id];
      if (updated?.layout.kind === 'ABSOLUTE') {
        this.setDraft(
          prop,
          rule.decimals ? formatMmValue(updated.layout[prop]) : formatRotationValue(updated.layout[prop]),
        );
        return;
      }
    }

    this.setDraft(prop, rule.decimals ? formatMmValue(current) : formatRotationValue(current));
  }

  protected revertFrame(prop: FrameProp, event: Event): void {
    event.preventDefault();
    const node = this.singleNode();
    if (!node || node.layout.kind !== 'ABSOLUTE') return;
    const rule = FRAME_RULES[prop];
    const current = node.layout[prop];
    this.setDraft(prop, rule.decimals ? formatMmValue(current) : formatRotationValue(current));
    if (this.invalidField() === prop) {
      this.invalidField.set(null);
      this.frameError.set(null);
    }
  }

  protected toggleLock(node: TemplateNode): void {
    if (this.state.readOnly()) return;
    this.state.updateNode(node.id, { locked: !node.locked });
  }

  protected moveFlow(node: TemplateNode, delta: -1 | 1): void {
    if (this.state.readOnly() || node.locked) return;
    this.state.moveInFlow(node.id, delta);
  }

  protected runTypeAction(nodeId: string, kind: string): void {
    switch (kind) {
      case 'replaceImage':
        this.state.run({ kind: 'replaceImage', nodeId });
        break;
      case 'editTextContent':
        this.state.run({ kind: 'editTextContent', nodeId });
        break;
      case 'editBinding':
        this.state.run({ kind: 'editBinding', nodeId });
        break;
      case 'openTableSettings':
        this.state.run({ kind: 'openTableSettings', nodeId });
        break;
      case 'editFormula':
        this.state.run({ kind: 'editFormula', nodeId });
        break;
      case 'openTotals':
        this.state.run({ kind: 'openTotals', nodeId });
        break;
      case 'editLink':
        this.state.run({ kind: 'editLink', nodeId });
        break;
    }
  }

  protected openProperties(nodeId: string): void {
    this.state.run({ kind: 'openProperties', nodeId });
  }

  protected openVisibility(nodeId: string): void {
    this.state.run({ kind: 'openVisibility', nodeId });
  }

  protected alignSelected(
    edge: 'START' | 'CENTER_H' | 'END' | 'TOP' | 'CENTER_V' | 'BOTTOM',
  ): void {
    if (this.state.readOnly() || !this.hasUnlockedAbsoluteInMulti()) return;
    this.state.align(this.state.selectedIds(), edge);
  }

  protected duplicateSelected(): void {
    if (this.state.readOnly() || this.allSelectedLocked()) return;
    this.state.duplicateNodes(this.state.selectedIds());
  }

  protected removeSelected(): void {
    if (this.state.readOnly() || this.allSelectedLocked()) return;
    this.state.removeNodes(this.state.selectedIds());
  }

  private syncDraftsFromNode(node: TemplateNode | null): void {
    this.invalidField.set(null);
    this.frameError.set(null);
    if (!node || node.layout.kind !== 'ABSOLUTE') return;
    this.draftX.set(formatMmValue(node.layout.x));
    this.draftY.set(formatMmValue(node.layout.y));
    this.draftW.set(formatMmValue(node.layout.width));
    this.draftH.set(formatMmValue(node.layout.height));
    this.draftRot.set(formatRotationValue(node.layout.rotationDeg));
  }

  private getDraft(prop: FrameProp): string {
    switch (prop) {
      case 'x':
        return this.draftX();
      case 'y':
        return this.draftY();
      case 'width':
        return this.draftW();
      case 'height':
        return this.draftH();
      case 'rotationDeg':
        return this.draftRot();
    }
  }

  private setDraft(prop: FrameProp, value: string): void {
    switch (prop) {
      case 'x':
        this.draftX.set(value);
        break;
      case 'y':
        this.draftY.set(value);
        break;
      case 'width':
        this.draftW.set(value);
        break;
      case 'height':
        this.draftH.set(value);
        break;
      case 'rotationDeg':
        this.draftRot.set(value);
        break;
    }
  }
}
