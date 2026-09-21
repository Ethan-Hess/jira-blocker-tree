import { useState } from "react";
import { issueBrowseUrl } from "../shared/issueKey";
import type { IssueSummary, TreeNode } from "../shared/types";
import { BlockedIcon, ChevronIcon } from "./icons";

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
}

export function TreeNodeRow({ node, depth }: TreeNodeRowProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isPlaceholder = node.kind === "cycle" || node.kind === "truncated";
  const isDone = node.issue.statusCategory === "done";
  const blockerCount = node.children.filter(
    (child) => child.kind === "blocker",
  ).length;

  return (
    <div className="jbt-node">
      <div className={`jbt-row${node.kind === "root" ? " jbt-row-root" : ""}`}>
        <button
          type="button"
          className="jbt-expander"
          aria-label={expanded ? "Collapse" : "Expand"}
          aria-expanded={expanded}
          disabled={!hasChildren}
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronIcon />
        </button>

        {isPlaceholder ? (
          <>
            <span className="jbt-summary jbt-summary-muted">
              {node.issue.key} · {node.message}
            </span>
          </>
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
            >
              {node.issue.key}
            </a>

            <span className="jbt-summary" title={node.issue.summary}>
              {node.issue.summary}
            </span>

            {blockerCount > 0 && (
              <span
                className="jbt-blocked-flag"
                title={`Blocked by ${blockerCount} issue(s)`}
              >
                <BlockedIcon />
                {blockerCount}
              </span>
            )}

            <StatusLozenge issue={node.issue} />
            <Avatar assignee={node.issue.assigneeDisplayName} />
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
