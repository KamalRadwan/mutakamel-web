"use client";

import Link from "next/link";
import { Building2, ChevronRight, Eye, Layers, Store, Users } from "lucide-react";
import { Badge, Button, cn, iconSize, IdentifierText, mirrorInRtl } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { OrgLevel, OrgTreeNode } from "../../contracts/organization-contract";
import { ORG_LEVEL_ORDER } from "../level-config";

/** The tree is company → branch → department → team, in that fixed order. */
const LEVEL_HREF = [
  TENANT_ROUTES.coreCompanies,
  TENANT_ROUTES.coreBranches,
  TENANT_ROUTES.coreDepartments,
  TENANT_ROUTES.coreTeams,
] as const;

const LEVEL_ICONS = [Building2, Store, Layers, Users] as const;

interface OrganizationTreeNodesProps {
  nodes: OrgTreeNode[];
  depth: number;
  expandedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onQuickView: (level: OrgLevel, node: OrgTreeNode) => void;
}

export function OrganizationTreeNodes({
  nodes,
  depth,
  expandedIds,
  onToggle,
  onQuickView,
}: OrganizationTreeNodesProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const clampedDepth = Math.min(depth, LEVEL_HREF.length - 1);
  const level = ORG_LEVEL_ORDER[clampedDepth];
  const href = LEVEL_HREF[clampedDepth];
  const levelLabel = copy.levels[level].singular;
  const LevelIcon = LEVEL_ICONS[clampedDepth];

  return (
    <ul
      role="group"
      className={cn(
        "flex flex-col gap-0.5",
        depth > 0 && "ms-5 border-s border-border ps-2",
      )}
    >
      {nodes.map((node) => {
        const isExpanded = expandedIds.has(node.id);
        const hasChildren = node.children.length > 0;

        return (
          <li
            key={node.id}
            role="treeitem"
            // The tree is navigational, not a selection control — nothing here
            // is ever "the selected node" — but the role requires the state, so
            // every item reports false rather than omitting it.
            aria-selected={false}
            aria-expanded={hasChildren ? isExpanded : undefined}
          >
            <div className="group flex min-h-9 items-center justify-between gap-2 rounded-sm px-1.5 py-0.5 hover:bg-muted">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {hasChildren ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onToggle(node.id)}
                    aria-label={isExpanded ? copy.tree.collapse : copy.tree.expand}
                    aria-expanded={isExpanded}
                  >
                    <ChevronRight
                      className={cn(
                        iconSize({ size: "sm" }),
                        mirrorInRtl,
                        "transition-transform",
                        isExpanded && "rotate-90",
                      )}
                      aria-hidden="true"
                    />
                  </Button>
                ) : (
                  <span className="inline-block size-6 shrink-0" aria-hidden="true" />
                )}

                <LevelIcon
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />

                <Link
                  href={`${href}/${node.id}`}
                  className="truncate text-xs font-medium text-foreground hover:underline"
                >
                  {node.name}
                </Link>

                <IdentifierText className="shrink-0 text-2xs text-muted-foreground">
                  {node.code}
                </IdentifierText>

                <span className="hidden text-2xs text-muted-foreground sm:inline">
                  {levelLabel}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <Badge tone={node.status === "ACTIVE" ? "positive" : "neutral"}>
                  {copy.orgStatus[node.status]}
                </Badge>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onQuickView(level, node)}
                  aria-label={`${copy.actions.view}: ${node.name}`}
                >
                  <Eye className="size-3.5 text-muted-foreground" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {hasChildren && isExpanded ? (
              <OrganizationTreeNodes
                nodes={node.children}
                depth={depth + 1}
                expandedIds={expandedIds}
                onToggle={onToggle}
                onQuickView={onQuickView}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
