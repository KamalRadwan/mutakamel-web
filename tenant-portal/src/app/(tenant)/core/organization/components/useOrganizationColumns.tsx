"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Badge, Button, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { OrgLevel, OrgNodeOf } from "../../contracts/organization-contract";
import type { OrgLevelConfig } from "../level-config";

interface OrganizationColumnOptions<L extends OrgLevel> {
  config: OrgLevelConfig;
  canManage: boolean;
  onEdit: (node: OrgNodeOf<L>) => void;
  onDelete: (node: OrgNodeOf<L>) => void;
}

/**
 * The four organization levels share one table.
 *
 * Only branches carry `isHeadquarters`, so that badge is keyed off the field
 * being present on the row rather than off the level — the level's own config
 * already says which fields exist, and duplicating that here would be a second
 * source of the same truth.
 */
export function useOrganizationColumns<L extends OrgLevel>({
  config,
  canManage,
  onEdit,
  onDelete,
}: OrganizationColumnOptions<L>): ColumnDef<OrgNodeOf<L>>[] {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const levelCopy = copy.levels[config.level];

  const columns: ColumnDef<OrgNodeOf<L>>[] = [
    {
      id: "name",
      sortable: true,
      header: levelCopy.nameLabel,
      cell: (node) => (
        <Link href={`${config.href}/${node.id}`} className="hover:underline">
          <span className="font-medium text-foreground">{node.name}</span>
        </Link>
      ),
    },
    {
      id: "code",
      sortable: true,
      header: copy.fields.code,
      cell: (node) => <span className="font-mono text-2xs">{node.code}</span>,
    },
    {
      id: "status",
      header: copy.fields.status,
      cell: (node) => (
        <div className="flex items-center gap-1.5">
          <Badge tone={node.status === "ACTIVE" ? "positive" : "neutral"}>
            {copy.orgStatus[node.status]}
          </Badge>
          {"isHeadquarters" in node && node.isHeadquarters ? (
            <Badge tone="brand">{copy.fields.headquarters}</Badge>
          ) : null}
        </div>
      ),
    },
  ];

  if (!canManage) return columns;

  return [
    ...columns,
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (node) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(node)}
            aria-label={`${copy.actions.edit}: ${node.name}`}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(node)}
            aria-label={`${t.common.delete}: ${node.name}`}
          >
            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];
}
