import type {
  TemplateDocumentType,
  TemplateLayoutMode,
  TemplateLifecycleStatus,
  TemplateOutputChannel,
  TemplateValidationState,
} from '../templates.model';

/** Badge visual variants aligned with design-system/components/badge/README.md. */
export type TemplateBadgeVariant = 'success' | 'danger' | 'warning' | 'status-none' | 'brand-soft' | 'neutral-soft';

export interface TemplateFamilyMeta {
  icon: string;
  tile: string;
  textColor: string;
  labelKey: string;
}

export interface TemplateChannelMeta {
  icon: string;
  tile: string;
  labelKey: string;
}

export interface TemplateLayoutMeta {
  labelKey: string;
  shortLabelKey: string;
  descriptionKey: string;
  badgeVariant: TemplateBadgeVariant;
  badgeClasses: string;
}

export interface TemplateValidationMeta {
  labelKey: string;
  badgeVariant: TemplateBadgeVariant;
  badgeClasses: string;
}

export interface TemplateLifecycleMeta {
  labelKey: string;
  badgeVariant: TemplateBadgeVariant;
  badgeClasses: string;
}

/** Provisional icon & tile colour mapping per approved decision D6. */
export const TEMPLATE_FAMILY_META: Readonly<Record<TemplateDocumentType, TemplateFamilyMeta>> = {
  QUOTATION: {
    icon: 'tablerFileText',
    tile: 'bg-icon-teal',
    textColor: 'text-icon-teal',
    labelKey: 'templates.families.QUOTATION',
  },
  PURCHASE_QUOTATION: {
    icon: 'tablerFileText',
    tile: 'bg-icon-orange',
    textColor: 'text-icon-orange',
    labelKey: 'templates.families.PURCHASE_QUOTATION',
  },
  SALES_ORDER: {
    icon: 'tablerReceipt',
    tile: 'bg-icon-green',
    textColor: 'text-icon-green',
    labelKey: 'templates.families.SALES_ORDER',
  },
  PURCHASE_ORDER: {
    icon: 'tablerShoppingCart',
    tile: 'bg-icon-orange',
    textColor: 'text-icon-orange',
    labelKey: 'templates.families.PURCHASE_ORDER',
  },
  INVOICE: {
    icon: 'tablerFileInvoice',
    tile: 'bg-icon-blue',
    textColor: 'text-icon-blue',
    labelKey: 'templates.families.INVOICE',
  },
  CONTRACT: {
    icon: 'tablerFileDescription',
    tile: 'bg-icon-navy',
    textColor: 'text-icon-navy',
    labelKey: 'templates.families.CONTRACT',
  },
  LETTER: {
    icon: 'tablerFileText',
    tile: 'bg-icon-navy',
    textColor: 'text-icon-navy',
    labelKey: 'templates.families.LETTER',
  },
  CRM_OUTBOUND_EMAIL: {
    icon: 'tablerMail',
    tile: 'bg-icon-blue',
    textColor: 'text-icon-blue',
    labelKey: 'templates.families.CRM_OUTBOUND_EMAIL',
  },
};

export const TEMPLATE_CHANNEL_META: Readonly<Record<TemplateOutputChannel, TemplateChannelMeta>> = {
  PRINT: {
    icon: 'tablerPrinter',
    tile: 'bg-icon-gray',
    labelKey: 'templates.channels.PRINT',
  },
  EMAIL: {
    icon: 'tablerMail',
    tile: 'bg-icon-blue',
    labelKey: 'templates.channels.EMAIL',
  },
};

export const TEMPLATE_LAYOUT_META: Readonly<Record<TemplateLayoutMode, TemplateLayoutMeta>> = {
  HYBRID_DOCUMENT: {
    labelKey: 'templates.layouts.HYBRID_DOCUMENT',
    shortLabelKey: 'templates.layoutsShort.HYBRID_DOCUMENT',
    descriptionKey: 'templates.layoutDescriptions.HYBRID_DOCUMENT',
    badgeVariant: 'neutral-soft',
    badgeClasses: 'bg-neutral-soft text-on-neutral-soft',
  },
  FLOW_DOCUMENT: {
    labelKey: 'templates.layouts.FLOW_DOCUMENT',
    shortLabelKey: 'templates.layoutsShort.FLOW_DOCUMENT',
    descriptionKey: 'templates.layoutDescriptions.FLOW_DOCUMENT',
    badgeVariant: 'neutral-soft',
    badgeClasses: 'bg-neutral-soft text-on-neutral-soft',
  },
  FIXED_CANVAS: {
    labelKey: 'templates.layouts.FIXED_CANVAS',
    shortLabelKey: 'templates.layoutsShort.FIXED_CANVAS',
    descriptionKey: 'templates.layoutDescriptions.FIXED_CANVAS',
    badgeVariant: 'neutral-soft',
    badgeClasses: 'bg-neutral-soft text-on-neutral-soft',
  },
  EMAIL_FLOW: {
    labelKey: 'templates.layouts.EMAIL_FLOW',
    shortLabelKey: 'templates.layoutsShort.EMAIL_FLOW',
    descriptionKey: 'templates.layoutDescriptions.EMAIL_FLOW',
    badgeVariant: 'neutral-soft',
    badgeClasses: 'bg-neutral-soft text-on-neutral-soft',
  },
};

export const TEMPLATE_VALIDATION_META: Readonly<Record<TemplateValidationState, TemplateValidationMeta>> = {
  PASSED: {
    labelKey: 'templates.validationStates.PASSED',
    badgeVariant: 'success',
    badgeClasses: 'bg-success text-on-success',
  },
  FAILED: {
    labelKey: 'templates.validationStates.FAILED',
    badgeVariant: 'danger',
    badgeClasses: 'bg-danger text-on-danger',
  },
  STALE: {
    labelKey: 'templates.validationStates.STALE',
    badgeVariant: 'warning',
    badgeClasses: 'bg-warning text-on-warning',
  },
  NOT_VALIDATED: {
    labelKey: 'templates.validationStates.NOT_VALIDATED',
    badgeVariant: 'status-none',
    badgeClasses: 'bg-status-none text-text',
  },
};

export const TEMPLATE_LIFECYCLE_META: Readonly<Record<TemplateLifecycleStatus, TemplateLifecycleMeta>> = {
  ACTIVE: {
    labelKey: 'templates.lifecycle.ACTIVE',
    badgeVariant: 'success',
    badgeClasses: 'bg-success text-on-success',
  },
  ARCHIVED: {
    labelKey: 'templates.lifecycle.ARCHIVED',
    badgeVariant: 'neutral-soft',
    badgeClasses: 'bg-neutral-soft text-on-neutral-soft',
  },
};

/** Resolve icon, tile token and i18n label key for a template document family and optional channel. */
export function templateFamilyMeta(
  documentType: TemplateDocumentType,
  outputChannel?: TemplateOutputChannel,
): TemplateFamilyMeta {
  if (outputChannel === 'EMAIL') {
    return TEMPLATE_FAMILY_META.CRM_OUTBOUND_EMAIL;
  }
  return TEMPLATE_FAMILY_META[documentType];
}

export function templateChannelMeta(outputChannel: TemplateOutputChannel): TemplateChannelMeta {
  return TEMPLATE_CHANNEL_META[outputChannel];
}

export function templateLayoutMeta(layoutMode: TemplateLayoutMode): TemplateLayoutMeta {
  return TEMPLATE_LAYOUT_META[layoutMode];
}

export function templateValidationMeta(state: TemplateValidationState): TemplateValidationMeta {
  return TEMPLATE_VALIDATION_META[state];
}
