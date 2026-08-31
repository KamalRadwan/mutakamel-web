"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  fetchOrgNode,
  type OrgLevel,
  type OrgNodeOf,
} from "../../contracts/organization-contract";
import { ORG_LEVEL_CONFIG } from "../level-config";

/**
 * One organization node for its detail screen.
 *
 * A 404 is kept separate from every other failure: the request succeeded and
 * the answer was "this no longer exists", which `NotFoundState` renders without
 * a retry button because retrying can never change it.
 */
export function useOrganizationNode<L extends OrgLevel>(level: L, id: string) {
  const { t, lang } = useI18n();
  const [node, setNode] = useState<OrgNodeOf<L> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [isMissing, setIsMissing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // Deferred past the effect body on purpose: a synchronous setState there
    // cascades an extra render (react-hooks/set-state-in-effect), and the abort
    // check means a torn-down screen never writes at all.
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!isUUIDv7(id)) {
        setIsLoading(false);
        setIsMissing(true);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      setIsMissing(false);
      fetchOrgNode(level, id, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setNode(result as OrgNodeOf<L>);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const normalized = normalizeApiError(error);
          setNode(null);
          if (normalized.status === 404) setIsMissing(true);
          else setLoadError(normalized);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [id, level, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    t,
    lang,
    config: ORG_LEVEL_CONFIG[level],
    node,
    isLoading,
    loadError,
    isMissing,
    reload,
  };
}
