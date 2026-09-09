"use client";

import { useEffect, useMemo, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import {
  CRM_CUSTOM_FIELDS_PATH,
  parseCrmCustomFieldsResponse,
  type CustomFieldItem,
} from "../../custom-fields/custom-field-contract";
import type { CrmCustomFieldValueOwnerType } from "../custom-fields-contract";

const CUSTOM_FIELDS_RESPONSE_LIMIT_BYTES = 512 * 1024;

/**
 * The custom fields a NEW record of one owner type may carry.
 *
 * This is not cosmetic completeness. Every CRM create service calls
 * `saveCustomFieldValues(..., CrmFieldRequirementOperationEnum.CREATE, ...)`,
 * and a definition with a required CREATE requirement makes the whole write
 * fail with `422 CUSTOM_FIELD_REQUIRED` — a create form that never showed the
 * field would be a dead end the user cannot get out of.
 *
 * A `LEAD` also carries every `LEAD_AND_PARTY` definition, because that scope
 * exists precisely so one definition covers a lead and the party it becomes;
 * `definitionsForOwnerType` makes the same choice on the read side, and the
 * scope list here is deliberately identical to it.
 *
 * It degrades rather than failing: a tenant that defines no custom fields is
 * the common case, and `crm.custom_fields.read` is a separate permission from
 * the create permission of any of these records. A 403 here must not stop the
 * record being created, so the section simply does not render and `degraded`
 * says why.
 */
export function useCrmCreateCustomFields(
  ownerType: CrmCustomFieldValueOwnerType,
  enabled: boolean,
) {
  const [items, setItems] = useState<CustomFieldItem[]>([]);
  const [degraded, setDegraded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) setLoading(true); });
    if (!enabled) return () => controller.abort();
    void (async () => {
      try {
        const response = await axiosClient.get<unknown>(CRM_CUSTOM_FIELDS_PATH, {
          signal: controller.signal,
          cache: "no-store",
          maxResponseBytes: CUSTOM_FIELDS_RESPONSE_LIMIT_BYTES,
        });
        if (controller.signal.aborted) return;
        setItems(parseCrmCustomFieldsResponse(response.data));
        setDegraded(false);
      } catch {
        if (controller.signal.aborted) return;
        setItems([]);
        setDegraded(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [enabled]);

  const definitions = useMemo(() => {
    const scopes: readonly string[] =
      ownerType === "LEAD" ? ["LEAD", "LEAD_AND_PARTY"] : [ownerType];
    return items
      .filter((item) => item.isActive && scopes.includes(item.ownerType))
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }, [items, ownerType]);

  // `entityScope` null means "every owner this definition applies to", so a
  // LEAD_AND_PARTY definition scoped to PARTY only is NOT required on a lead.
  const requiredFieldKeys = useMemo(
    () =>
      definitions
        .filter((definition) =>
          definition.requirements.some(
            (requirement) =>
              requirement.isRequired &&
              requirement.operation === "CREATE" &&
              (requirement.entityScope === null ||
                requirement.entityScope === ownerType),
          ),
        )
        .map((definition) => definition.fieldKey),
    [definitions, ownerType],
  );

  return { definitions, requiredFieldKeys, degraded, loading: enabled && loading };
}
