export interface CorePhoneSummary {
  servers: number;
  occupied: number;
  allowed: number;
  available: number;
  overAllowance: boolean;
}

export interface CrmSettings {
  id: string;
  leadsEnabled: boolean;
  opportunitiesEnabled: boolean;
  requireQualifiedStageForConversion: boolean;
  defaultPipelineId: string;
  outboundEmailContentRetentionDays: number;
  outboundEmailRetentionPolicyRevision: number;
  analyticsTimeZone: string;
  clickToCallEnabled: boolean;
  logCallsAsActivities: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrmSettingsPatch {
  leadsEnabled?: boolean;
  opportunitiesEnabled?: boolean;
  requireQualifiedStageForConversion?: boolean;
  // defaultPipelineId is not writable here: the backend UpdateCrmSettingsDto rejects it
  // (the default pipeline is set through the pipelines endpoints).
  outboundEmailContentRetentionDays?: number;
  expectedOutboundEmailRetentionPolicyRevision?: number;
  clickToCallEnabled?: boolean;
  logCallsAsActivities?: boolean;
}

export const GENERAL_LIMITS = {
  retentionMin: 30,
  retentionMax: 2555,
} as const;
