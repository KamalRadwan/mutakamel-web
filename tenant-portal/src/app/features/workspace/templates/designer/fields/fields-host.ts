import { Component, effect, inject, untracked, viewChild } from '@angular/core';
import type { TemplateDataFieldNode } from '../../templates.model';
import { DesignerState } from '../designer-state';
import { isInHeaderOrFooterZone } from '../document-ops';
import { FieldPickOptions, FieldPickResult, FieldPicker } from './field-picker/field-picker';
import { LayersModal } from './layers-modal/layers-modal';
import { PageSetupModal } from './page-setup-modal/page-setup-modal';
import { PagesModal } from './pages-modal/pages-modal';
import { PropertiesModal } from './properties-modal/properties-modal';
import { TextContentModal } from './text-content-modal/text-content-modal';
import { VisibilityModal } from './visibility-modal/visibility-modal';

@Component({
  selector: 'app-tpl-fields-host',
  imports: [
    FieldPicker,
    PropertiesModal,
    TextContentModal,
    VisibilityModal,
    PageSetupModal,
    LayersModal,
    PagesModal,
  ],
  templateUrl: './fields-host.html',
  host: { class: 'contents' },
})
export class FieldsHost {
  protected readonly state = inject(DesignerState);

  private readonly fieldPicker = viewChild.required<FieldPicker>('fieldPicker');
  private readonly propertiesModal = viewChild.required<PropertiesModal>('propertiesModal');
  private readonly textContentModal = viewChild.required<TextContentModal>('textContentModal');
  private readonly visibilityModal = viewChild.required<VisibilityModal>('visibilityModal');
  private readonly pageSetupModal = viewChild.required<PageSetupModal>('pageSetupModal');
  private readonly layersModal = viewChild.required<LayersModal>('layersModal');
  private readonly pagesModal = viewChild.required<PagesModal>('pagesModal');

  private lastSeq = untracked(() => this.state.command()?.seq ?? 0);

  protected readonly pickFieldFn = (options: FieldPickOptions): Promise<FieldPickResult | null> =>
    this.fieldPicker().open(options);

  constructor() {
    effect(() => {
      const entry = this.state.command();
      if (!entry || entry.seq <= this.lastSeq) return;
      this.lastSeq = entry.seq;

      const cmd = entry.cmd;
      untracked(() => {
        switch (cmd.kind) {
          case 'insertDataField':
            void this.handleInsertDataField();
            break;
          case 'editBinding':
            void this.handleEditBinding(cmd.nodeId);
            break;
          case 'openProperties':
            this.propertiesModal().open(cmd.nodeId);
            break;
          case 'editTextContent':
            this.textContentModal().open(cmd.nodeId);
            break;
          case 'openVisibility':
            this.visibilityModal().open(cmd.nodeId);
            break;
          case 'openPageSetup':
            this.pageSetupModal().open();
            break;
          case 'openLayers':
            this.layersModal().open();
            break;
          case 'openPages':
            this.pagesModal().open();
            break;
          default:
            break;
        }
      });
    });
  }

  private async handleInsertDataField(): Promise<void> {
    if (this.state.readOnly()) return;
    const res = await this.fieldPicker().open({
      purpose: 'DATA_FIELD',
      accept: 'SCALAR',
    });
    if (!res?.binding) return;

    this.state.insertNode({
      type: 'dataField',
      binding: res.binding,
      props: {
        ...(res.label ? { label: res.label } : {}),
        ...(res.labelPosition ? { labelPosition: res.labelPosition } : {}),
        ...(res.label && res.separator !== undefined ? { separator: res.separator } : {}),
      },
    });
  }

  private async handleEditBinding(nodeId: string): Promise<void> {
    if (this.state.readOnly()) return;
    const doc = this.state.document();
    const node = doc?.nodes[nodeId];
    if (!doc || !node || node.type !== 'dataField') return;

    const res = await this.fieldPicker().openDataFieldEdit(
      {
        purpose: 'DATA_FIELD',
        accept: 'SCALAR',
        initial: node.binding,
      },
      {
        label: node.props.label,
        labelPosition: node.props.labelPosition,
        separator: node.props.separator,
        inHeaderOrFooter: isInHeaderOrFooterZone(doc, node.id),
      },
    );
    if (!res?.binding) return;

    const patch: Partial<TemplateDataFieldNode> = {
      binding: res.binding,
      props: {
        ...(res.label ? { label: res.label } : {}),
        ...(res.labelPosition ? { labelPosition: res.labelPosition } : {}),
        ...(res.label && res.separator !== undefined ? { separator: res.separator } : {}),
      },
    };
    this.state.updateNode(node.id, patch, 'editBinding');
  }
}
