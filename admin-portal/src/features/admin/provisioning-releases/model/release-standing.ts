import type { ProvisioningComponent } from "@/features/admin/provisioning-governance/types";
import type { ProvisioningRelease } from "../types/provisioning-releases";

/**
 * The reason code the superseded-release retirement procedure records
 * (backend `mutakamel-apps/DATABASE_OPERATIONS.md`, "Retiring superseded
 * releases"). Core accepts any safe code; this is the one the procedure names.
 */
export const SUPERSEDED_RETIREMENT_REASON_CODE = "SUPERSEDED_BY_CURRENT_RELEASE";

/**
 * Where a release stands against the provisioning catalogue.
 *
 * - `CURRENT`: its component's one current release, the only one Core plans
 *   and executes. It must never be retired.
 * - `SUPERSEDED`: PUBLISHED, but its component has another current release.
 *   Nothing selects it; it waits to be retired.
 * - `RETIRED`: already retired.
 * - `UNKNOWN`: the catalogue could not be read, or it does not name a current
 *   release for this component, so neither of the first two can be stated.
 */
export type ReleaseCatalogueStanding =
  | "CURRENT"
  | "SUPERSEDED"
  | "RETIRED"
  | "UNKNOWN";

interface ReleaseCatalogueComponent {
  key: string;
  currentReleaseId: string | null;
}

/** Active components by lowercase id. */
export type ReleaseComponentCatalogue = ReadonlyMap<
  string,
  ReleaseCatalogueComponent
>;

/**
 * Indexes `GET /provisioning/components`. Its `latestPublishedRelease` is the
 * component's current catalogue release, selected by catalogue identity rather
 * than as the newest PUBLISHED row (core-app `provisioning-current-release.ts`,
 * `currentReleaseRows`); the release list carries no such flag of its own.
 */
export function releaseComponentCatalogue(
  components: readonly Pick<
    ProvisioningComponent,
    "id" | "key" | "latestPublishedRelease"
  >[],
): ReleaseComponentCatalogue {
  return new Map(
    components.map((component) => [
      component.id.toLowerCase(),
      {
        key: component.key,
        currentReleaseId:
          component.latestPublishedRelease?.id.toLowerCase() ?? null,
      },
    ]),
  );
}

export function releaseCatalogueStanding(
  release: Pick<ProvisioningRelease, "releaseId" | "componentId" | "status">,
  catalogue: ReleaseComponentCatalogue | null,
): ReleaseCatalogueStanding {
  if (release.status === "RETIRED") return "RETIRED";
  const component = catalogue?.get(release.componentId.toLowerCase());
  // Without a current release on record there is nothing that supersedes it.
  if (!component?.currentReleaseId) return "UNKNOWN";
  return component.currentReleaseId === release.releaseId.toLowerCase()
    ? "CURRENT"
    : "SUPERSEDED";
}
