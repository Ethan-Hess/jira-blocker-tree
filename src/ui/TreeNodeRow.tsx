import { useState } from "react";
import { issueBrowseUrl } from "../shared/issueKey";
import type { IssueSummary, TreeNode } from "../shared/types";
import { ChevronIcon } from "./icons";
import { PriorityLozenge } from "./PriorityLozenge";

function typeClass(issueTypeName: string): string {
  const name = issueTypeName.toLowerCase();
  if (name.includes("epic")) return "jbt-type-epic";
  if (name.includes("bug")) return "jbt-type-bug";
  if (name.includes("story")) return "jbt-type-story";
  if (name.includes("task") || name.includes("sub")) return "jbt-type-task";
  return "jbt-type-other";
}

function typeInitial(issueTypeName: string): string {
  return issueTypeName ? issueTypeName.charAt(0).toUpperCase() : "?";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}

function Avatar({ assignee }: { assignee: string | null }) {
  if (!assignee) {
    return (
      <span className="jbt-avatar jbt-avatar-unassigned" title="Unassigned">
        ?
      </span>
    );
  }
  return (
    <span className="jbt-avatar" title={assignee}>
      {initials(assignee)}
    </span>
  );
}

function StatusLozenge({ issue }: { issue: IssueSummary }) {
  if (!issue.statusName) return null;
  return (
    <span
      className={`jbt-lozenge jbt-lozenge-${issue.statusCategory}`}
      title={issue.statusName}
    >
      {issue.statusName}
    </span>
  );
}

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

export function TreeNodeRow({
  node,
  depth,
  selectedKey,
  onSelect,
}: TreeNodeRowProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isPlaceholder = node.kind === "cycle" || node.kind === "truncated";
  const isDone = node.issue.statusCategory === "done";
  const isSelected = selectedKey === node.issue.key;

  const rowClass = [
    "jbt-row",
    "jbt-tree-grid",
    node.kind === "root" ? "jbt-row-root" : "",
    node.issue.onCriticalPath ? "jbt-row-critical" : "",
    isSelected ? "jbt-row-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="jbt-node">
      <div
        className={rowClass}
        role="row"
        onClick={() => !isPlaceholder && onSelect(node.issue.key)}
      >
        <div
          className="jbt-col-issue"
          style={{ paddingLeft: depth > 0 ? depth * 12 : undefined }}
        >
          <button
            type="button"
            className="jbt-expander"
            aria-label={expanded ? "Collapse" : "Expand"}
            aria-expanded={expanded}
            disabled={!hasChildren}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
          >
            <ChevronIcon />
          </button>

          {isPlaceholder ? (
            <span className="jbt-summary jbt-summary-muted">
              {node.issue.key} · {node.message}
            </span>
          ) : (
            <>
              <span
                className={`jbt-type ${typeClass(node.issue.issueTypeName)}`}
                title={node.issue.issueTypeName}
              >
                {typeInitial(node.issue.issueTypeName)}
              </span>

              <a
                className={`jbt-key${isDone ? " jbt-key-done" : ""}`}
                href={issueBrowseUrl(node.issue.key)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {node.issue.key}
              </a>

              <span className="jbt-summary" title={node.issue.summary}>
                {node.issue.summary}
              </span>
            </>
          )}
        </div>

        {!isPlaceholder && (
          <>
            <div className="jbt-col-leverage" title="Leverage (impact × priority weight)">
              {node.issue.leverage}
            </div>
            <div className="jbt-col-priority">
              <PriorityLozenge issue={node.issue} />
            </div>
            <div className="jbt-col-status">
              <StatusLozenge issue={node.issue} />
            </div>
            <div className="jbt-col-assignee">
              <Avatar assignee={node.issue.assigneeDisplayName} />
            </div>
          </>
        )}
      </div>

      {expanded && hasChildren && (
        <div className="jbt-children">
          {node.children.map((child) => (
            <TreeNodeRow
              key={`${node.issue.key}-${child.kind}-${child.issue.key}`}
              node={child}
              depth={depth + 1}
              selectedKey={selectedKey}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
