"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge, Button, cn, iconSize, IdentifierText, mirrorInRtl } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { OrgTreeNode } from "../../contracts/organization-contract";

/** The tree is company → branch → department → team, in that fixed order. */
const LEVEL_HREF = [
  TENANT_ROUTES.coreCompanies,
  TENANT_ROUTES.coreBranches,
  TENANT_ROUTES.coreDepartments,
  TENANT_ROUTES.coreTeams,
] as const;

const LEVEL_LABEL_KEY = ["companies", "branches", "departments", "teams"] as const;

interface OrganizationTreeNodesProps {
  nodes: OrgTreeNode[];
  depth: number;
  expandedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
}

export function OrganizationTreeNodes({
  nodes,
  depth,
  expandedIds,
  onToggle,
}: OrganizationTreeNodesProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const href = LEVEL_HREF[Math.min(depth, LEVEL_HREF.length - 1)];
  const levelLabel = copy.levels[LEVEL_LABEL_KEY[Math.min(depth, 3)]].singular;

  return (
    <ul role="group" className={cn("flex flex-col gap-0.5", depth > 0 && "ms-5")}>
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
            <div className="flex min-h-9 items-center gap-1.5 rounded-sm px-1 hover:bg-muted">
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
                <span className="inline-block size-6" aria-hidden="true" />
              )}

              <Link href={`${href}/${node.id}`} className="text-xs font-medium text-foreground hover:underline">
                {node.name}
              </Link>
              <IdentifierText className="text-2xs text-muted-foreground">{node.code}</IdentifierText>
              <span className="text-2xs text-muted-foreground">{levelLabel}</span>
              {node.status === "INACTIVE" ? (
                <Badge tone="neutral">{copy.orgStatus.INACTIVE}</Badge>
              ) : null}
            </div>

            {hasChildren && isExpanded ? (
              <OrganizationTreeNodes
                nodes={node.children}
                depth={depth + 1}
                expandedIds={expandedIds}
                onToggle={onToggle}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
