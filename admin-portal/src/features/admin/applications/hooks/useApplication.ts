import { useState, useCallback, useEffect } from "react";
import { applicationsApi } from "../api/applications.api";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useActionMutation } from "@/shared/hooks/useActionMutation";
import { useToast } from "@/components/ui/ToastContext";
import {
  ApplicationView,
  UpdateApplicationDto,
  UpdateApplicationDatabasePolicyDto,
  ApplicationLifecycleCommandDto,
  ApplicationManifestEvidenceView,
  PublishApplicationDto,
} from "../types";

export function useApplication(applicationKey: string) {
  const toast = useToast();
  const { mutate, isMutating } = useActionMutation();

  const [application, setApplication] = useState<ApplicationView | null>(null);
  const [manifests, setManifests] = useState<ApplicationManifestEvidenceView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [isManifestLoading, setIsManifestLoading] = useState(false);

  const fetchManifests = useCallback(async () => {
    setIsManifestLoading(true);
    setManifestError(null);
    try {
      setManifests(await applicationsApi.getManifests(applicationKey));
    } catch (err) {
      const normalized = normalizeApiError(err);
      setManifestError(normalized.message);
    } finally {
      setIsManifestLoading(false);
    }
  }, [applicationKey]);

  const fetchApplication = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await applicationsApi.get(applicationKey);
      setApplication(data);

      await fetchManifests();
    } catch (err) {
      const normalized = normalizeApiError(err);
      setError(normalized.message);
      toast.error("Error", normalized.message);
    } finally {
      setIsLoading(false);
    }
  }, [applicationKey, fetchManifests, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchApplication();
  }, [fetchApplication]);

  const updateApplication = (dto: UpdateApplicationDto) =>
    mutate(
      { operation: "UPDATE", applicationKey, dto },
      (key) => applicationsApi.update(applicationKey, dto, key),
      { onSuccessMessage: "Application updated successfully.", onSuccess: fetchApplication }
    );

  const updateDatabasePolicy = (dto: UpdateApplicationDatabasePolicyDto) =>
    mutate(
      { operation: "UPDATE_DATABASE_POLICY", applicationKey, dto },
      (key) => applicationsApi.updateDatabasePolicy(applicationKey, dto, key),
      { onSuccessMessage: "Database policy updated.", onSuccess: fetchApplication }
    );

  const publishApplication = (dto: PublishApplicationDto) =>
    mutate(
      { operation: "PUBLISH", applicationKey, dto },
      (key) => applicationsApi.publish(applicationKey, dto, key),
      {
        onSuccessMessage: "Application revision published.",
        onSuccess: fetchApplication,
      },
    );

  const activateApplication = (expectedCatalogueRevision: string, reason: string) => {
    const payload = { expectedCatalogueRevision, reason };
    return mutate(
      { operation: "ACTIVATE", applicationKey, dto: payload },
      (key) => applicationsApi.activate(applicationKey, expectedCatalogueRevision, reason, key),
      { onSuccessMessage: "Application activated.", onSuccess: fetchApplication }
    );
  };

  const deprecateApplication = (dto: ApplicationLifecycleCommandDto) =>
    mutate(
      { operation: "DEPRECATE", applicationKey, dto },
      (key) => applicationsApi.deprecate(applicationKey, dto, key),
      { onSuccessMessage: "Application deprecated.", onSuccess: fetchApplication }
    );

  const disableApplication = (dto: ApplicationLifecycleCommandDto) =>
    mutate(
      { operation: "DISABLE", applicationKey, dto },
      (key) => applicationsApi.disable(applicationKey, dto, key),
      { onSuccessMessage: "Application disabled.", onSuccess: fetchApplication }
    );

  const deleteApplication = (expectedCatalogueRevision: string, reason: string) => {
    const payload = { expectedCatalogueRevision, reason };
    return mutate(
      { operation: "DELETE", applicationKey, dto: payload },
      async (key) => {
        await applicationsApi.delete(applicationKey, expectedCatalogueRevision, reason, key);
        return true;
      },
      { onSuccessMessage: "Application deleted." }
    );
  };

  return {
    application,
    manifests,
    manifestError,
    isManifestLoading,
    isMutating,
    isLoading,
    error,
    fetchApplication,
    fetchManifests,
    updateApplication,
    updateDatabasePolicy,
    publishApplication,
    activateApplication,
    deprecateApplication,
    disableApplication,
    deleteApplication
  };
}
