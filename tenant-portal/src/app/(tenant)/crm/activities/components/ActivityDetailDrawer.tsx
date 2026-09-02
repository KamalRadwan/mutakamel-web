"use client";

import {
  Badge,
  DateTime,
  DetailSection,
  IdentifierText,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatusBadge,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CrmActivity } from "../activity-contract";

interface ActivityDetailDrawerProps {
  activity: CrmActivity | null;
  onClose: () => void;
}

/**
 * The activity detail surface — task 8.27, as far as the API allows.
 *
 * There is **no `GET /activities/:id`** on this controller, and the list query
 * has no id filter, so a routed `/crm/activities/[id]` page could not fetch
 * the record it is addressed by. Rather than scan pages until one matches,
 * detail is a drawer over the row the list already holds: every field the list
 * projection returns, and nothing invented. Recorded as Q52 in
 * docs/build/OPEN-QUESTIONS.md.
 */
export function ActivityDetailDrawer({
  activity,
  onClose,
}: ActivityDetailDrawerProps) {
  const { t } = useI18n();

  return (
    <Sheet
      open={activity !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{activity?.subject ?? ""}</SheetTitle>
          <SheetDescription>{t.crmActivities.detailDescription}</SheetDescription>
        </SheetHeader>
        {activity ? (
          <div className="flex flex-col gap-4 overflow-y-auto p-4">
            <DetailSection
              title={t.crmActivities.summaryTitle}
              emptyValueLabel={t.common.noData}
              fields={[
                {
                  label: t.crmActivities.type,
                  value: (
                    <Badge tone="neutral">
                      {t.crmActivities.typeValues[activity.type] ?? activity.type}
                    </Badge>
                  ),
                },
                {
                  label: t.common.status,
                  value: (
                    <StatusBadge
                      kind="CrmActivityStatus"
                      value={activity.status}
                    />
                  ),
                },
                {
                  label: t.crmActivities.direction,
                  value: activity.direction
                    ? (t.crmActivities.directionValues[activity.direction] ??
                      activity.direction)
                    : null,
                },
                {
                  label: t.crmActivities.source,
                  value: (
                    <span className="flex flex-col gap-0.5">
                      <span>
                        {t.crmActivities.sourceTypes[activity.sourceType] ??
                          activity.sourceType}
                      </span>
                      <IdentifierText className="text-2xs text-muted-foreground">
                        {activity.sourceId}
                      </IdentifierText>
                    </span>
                  ),
                },
                {
                  label: t.crmActivities.activityAt,
                  value: activity.activityAt ? (
                    <DateTime value={activity.activityAt} />
                  ) : null,
                },
                {
                  label: t.crmActivities.completedAt,
                  value: activity.completedAt ? (
                    <DateTime value={activity.completedAt} />
                  ) : null,
                },
                {
                  label: t.crmActivities.description,
                  value: activity.description,
                  wide: true,
                },
                {
                  label: t.crmActivities.outcome,
                  value: activity.outcome,
                  wide: true,
                },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              {t.crmActivities.noDetailRoute}
            </p>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
