import { STARTER_CATALOGUE_DATA } from './starter-catalogue.data';

/** Existing Core listStarters descriptor fields; this is not a new API DTO. */
export interface StarterDiscoveryPins {
  readonly starterKey: string;
  readonly displayName: string;
  readonly documentType: string;
  readonly outputChannel: string;
  readonly layoutMode: string;
  readonly dataSourceKey: string;
  readonly dataSourceSchemaVersion: number;
  readonly dataSourceSchemaChecksum: string;
  readonly locale: string;
  readonly resolvedDirection: string;
  readonly editorSchemaVersion: number;
  readonly nodeRegistryVersion: string;
  readonly templateContentChecksum: string;
  readonly descriptorChecksum: string;
}

export interface StarterCatalogueTuple {
  readonly documentType: string;
  readonly outputChannel: string;
  readonly layoutMode: string;
  readonly dataSourceKey: string;
  readonly dataSourceSchemaVersion: number;
  readonly locale: 'ar-EG' | 'en-US';
  readonly direction: 'AUTO' | 'RTL' | 'LTR';
}

interface PrintThumbnailSource {
  readonly kind: 'PRINT_DOCUMENT';
  readonly fixtureKey: string;
  readonly page: {
    readonly unit: 'MM'; readonly preset: 'A4'; readonly widthMm: number; readonly heightMm: number;
    readonly orientation: 'PORTRAIT';
    readonly marginMm: { readonly top: number; readonly end: number; readonly bottom: number; readonly start: number };
  };
}

interface EmailThumbnailSource {
  readonly kind: 'RESPONSIVE_EMAIL';
  readonly fixtureKey: string;
  readonly maxWidthPx: number;
}

/** Local presentation metadata; thumbnailSource is input, never an artifact URL or readiness claim. */
export interface StarterCatalogueMetadata {
  readonly semanticDesignId: string;
  readonly authoringTaskId: string;
  readonly sortOrder: number;
  readonly referenceImageId: string;
  readonly outputProfile: 'DOCUMENT_PRINT' | 'EMAIL_PRINT_PROJECTION';
  readonly thumbnailSource: PrintThumbnailSource | EmailThumbnailSource;
}

export interface StarterCatalogueRecord {
  readonly descriptor: StarterDiscoveryPins;
  readonly metadata: StarterCatalogueMetadata;
}

// The sealed successor revises the two Structured Opportunity descriptors.
const CRM_SUCCESSOR_REVISIONS = new Map<string, Pick<
  StarterDiscoveryPins, 'starterKey' | 'templateContentChecksum' | 'descriptorChecksum'
>>([
  ['crm.email.opportunity.structured-opportunity.ar-EG.v1', {
    starterKey: 'crm.email.opportunity.structured-opportunity.ar-EG.v2',
    templateContentChecksum: '632329210505e1452f6e5fd8e937d7cecd5e491bc6c2b39b2ec856974dc3b762',
    descriptorChecksum: '28d39a20ef4fef51fd3efb91306210e130bc12c426972b6a21ac5dc658ed09e5',
  }],
  ['crm.email.opportunity.structured-opportunity.en-US.v1', {
    starterKey: 'crm.email.opportunity.structured-opportunity.en-US.v2',
    templateContentChecksum: '85916b47b922a06c48ecf20cd1294541a8b9ac119104d06d71b5426dfe8f3f6c',
    descriptorChecksum: 'cfcc0a642de7bebc591239884608ed31c17f3e700c97be5b71261cfbca6dd6f2',
  }],
]);

const DESCRIPTOR_FIELDS = [
  'starterKey', 'displayName', 'documentType', 'outputChannel', 'layoutMode', 'dataSourceKey',
  'dataSourceSchemaVersion', 'dataSourceSchemaChecksum', 'locale', 'resolvedDirection',
  'editorSchemaVersion', 'nodeRegistryVersion', 'templateContentChecksum', 'descriptorChecksum',
] as const satisfies readonly (keyof StarterDiscoveryPins)[];

/** Enrich only a descriptor already returned by authorized discovery. Unknown/stale resources stay unadorned. */
export function findStarterCatalogueMetadata(
  starter: Readonly<StarterDiscoveryPins>,
  requested: Readonly<StarterCatalogueTuple>,
  useCrmSuccessorDescriptors = false,
): StarterCatalogueMetadata | null {
  const direction = requested.direction === 'AUTO'
    ? requested.locale === 'ar-EG' ? 'RTL' : requested.locale === 'en-US' ? 'LTR' : null
    : requested.direction;
  if (!direction || starter.documentType !== requested.documentType ||
    starter.outputChannel !== requested.outputChannel || starter.layoutMode !== requested.layoutMode ||
    starter.dataSourceKey !== requested.dataSourceKey || starter.dataSourceSchemaVersion !== requested.dataSourceSchemaVersion ||
    starter.locale !== requested.locale || starter.resolvedDirection !== direction) return null;
  const entry = STARTER_CATALOGUE_DATA.find(({ descriptor }) => {
    const revision = useCrmSuccessorDescriptors ? CRM_SUCCESSOR_REVISIONS.get(descriptor.starterKey) : undefined;
    const expected = revision ? { ...descriptor, ...revision } : descriptor;
    return expected.starterKey === starter.starterKey &&
      DESCRIPTOR_FIELDS.every((field) => expected[field] === starter[field]);
  });
  return entry ? structuredClone(entry.metadata) : null;
}
