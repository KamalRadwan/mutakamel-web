import type {
  TemplateDataSourceKey,
  TemplateDocumentType,
  TemplateOutputChannel,
  TemplateProductionDisabledReason,
  TemplateScopeRef,
} from '../templates.api';

export interface AssignmentScopeOption {
  key: string;
  scope: TemplateScopeRef;
  icon: string;
  tile: string;
  label: string;
}

export interface DocumentVisualDescriptor {
  icon: string;
  tile: string;
  labelKey: string;
}

export interface AssignmentSelectorOption {
  adapterKey: TemplateDataSourceKey;
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  labelKey: string;
  /** Backend productionAssignmentEnabled (PRODUCTION_ASSIGNABLE_TEMPLATE_TUPLES). */
  productionAssignmentEnabled: boolean;
  /** Backend productionDisabledReason: null when enabled. */
  productionDisabledReason: TemplateProductionDisabledReason | null;
}
