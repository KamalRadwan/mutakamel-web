import { Component, effect, inject, untracked, viewChild } from '@angular/core';
import { DesignerState } from '../designer-state';
import { ImagePicker } from './image-picker/image-picker';

@Component({
  selector: 'app-tpl-tools-host',
  imports: [ImagePicker],
  templateUrl: './tools-host.html',
})
export class ToolsHost {
  private readonly state = inject(DesignerState);
  private readonly imagePicker = viewChild.required(ImagePicker);
  private lastSeq = this.state.command()?.seq ?? 0;

  constructor() {
    effect(() => {
      const evt = this.state.command();
      if (!evt || evt.seq === this.lastSeq) return;

      if (evt.cmd.kind === 'insertImage') {
        this.lastSeq = evt.seq;
        untracked(() => this.imagePicker().openInsert());
      } else if (evt.cmd.kind === 'replaceImage') {
        this.lastSeq = evt.seq;
        const nodeId = evt.cmd.nodeId;
        untracked(() => {
          const node = this.state.document()?.nodes[nodeId];
          if (node?.type === 'image') {
            this.imagePicker().openReplace({
              nodeId: node.id,
              assetId: node.props.assetId,
              alt: node.props.alt,
              decorative: node.props.decorative,
            });
          }
        });
      }
    });
  }
}
