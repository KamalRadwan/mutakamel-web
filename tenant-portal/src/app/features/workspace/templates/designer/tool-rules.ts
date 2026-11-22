import type { TemplateLayoutMode, TemplateOutputChannel } from '../templates.model';

export type DesignerTool =
  | 'SELECT'
  | 'TEXT'
  | 'IMAGE'
  | 'DATA_FIELD'
  | 'TABLE_STATIC'
  | 'TABLE_DYNAMIC'
  | 'FORMULA'
  | 'TOTALS'
  | 'LINE'
  | 'BUTTON'
  | 'LINK'
  | 'ALIGN'
  | 'ARRANGE'
  | 'LAYERS'
  | 'PAGES'
  | 'PAGE_SETUP'
  | 'EMAIL_SETTINGS';

export type DesignerToolReasonKey =
  | 'readOnly'
  | 'schemaUnavailable'
  | 'notInEmail'
  | 'printOnly'
  | 'emailOnly'
  | 'absoluteOnly'
  | 'notInZone';

export interface DesignerToolState {
  state: 'ENABLED' | 'DISABLED' | 'HIDDEN';
  reasonKey: DesignerToolReasonKey | null;
}

export interface ToolRuleContext {
  channel: TemplateOutputChannel | null;
  layoutMode: TemplateLayoutMode | null;
  readOnly: boolean;
  schemaFailed: boolean;
  hasAbsoluteSelection: boolean;
  inHeaderOrFooterZone: boolean;
}

const ENABLED: DesignerToolState = { state: 'ENABLED', reasonKey: null };

export function evaluateToolState(tool: DesignerTool, ctx: ToolRuleContext): DesignerToolState {
  if (tool === 'SELECT') return ENABLED;

  const isEmail = ctx.channel === 'EMAIL' || ctx.layoutMode === 'EMAIL_FLOW';
  const isFixedCanvas = ctx.layoutMode === 'FIXED_CANVAS';

  // Channel & layout visibility rules (facts §6 & §7 parent matrix)
  if (isEmail) {
    if (tool === 'PAGES' || tool === 'PAGE_SETUP') {
      return { state: 'HIDDEN', reasonKey: 'printOnly' };
    }
    if (tool === 'ALIGN' || tool === 'ARRANGE' || tool === 'TABLE_DYNAMIC' || tool === 'TOTALS') {
      return { state: 'HIDDEN', reasonKey: 'notInEmail' };
    }
  } else {
    if (tool === 'BUTTON' || tool === 'EMAIL_SETTINGS') {
      return { state: 'HIDDEN', reasonKey: 'emailOnly' };
    }
    if (tool === 'PAGES' && !isFixedCanvas) {
      return { state: 'HIDDEN', reasonKey: 'absoluteOnly' };
    }
    if (tool === 'TOTALS' && isFixedCanvas) {
      return { state: 'HIDDEN', reasonKey: 'notInZone' };
    }
    if (tool === 'LINK' && isFixedCanvas) {
      return { state: 'HIDDEN', reasonKey: 'notInZone' };
    }
  }

  if (ctx.readOnly) {
    return { state: 'DISABLED', reasonKey: 'readOnly' };
  }

  if (tool === 'DATA_FIELD' && ctx.schemaFailed) {
    return { state: 'DISABLED', reasonKey: 'schemaUnavailable' };
  }

  if (tool === 'ALIGN' || tool === 'ARRANGE') {
    if (!isFixedCanvas && !ctx.hasAbsoluteSelection) {
      return { state: 'DISABLED', reasonKey: 'absoluteOnly' };
    }
    if (!ctx.hasAbsoluteSelection) {
      return { state: 'DISABLED', reasonKey: 'absoluteOnly' };
    }
  }

  if (ctx.inHeaderOrFooterZone && (tool === 'TABLE_DYNAMIC' || tool === 'TOTALS')) {
    return { state: 'DISABLED', reasonKey: 'notInZone' };
  }

  return ENABLED;
}
