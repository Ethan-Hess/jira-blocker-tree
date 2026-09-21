import { useEffect, useMemo, useRef, useState } from "react";
import { buildLineageLayout } from "../shared/lineageLayers";
import {
  buildPedigreeGeometry,
  type PedigreeOrientation,
} from "../shared/pedigreeGeometry";
import { issueBrowseUrl } from "../shared/issueKey";
import type { IssueSummary } from "../shared/types";

export type { PedigreeOrientation };

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

interface LineageViewProps {
  focusKey: string;
  rootKey: string;
  epicChildKeys: string[];
  issuesByKey: Record<string, IssueSummary>;
  hideDone: boolean;
  onFocusKey: (key: string) => void;
}

export function LineageView({
  focusKey,
  rootKey,
  epicChildKeys,
  issuesByKey,
  hideDone,
  onFocusKey,
}: LineageViewProps) {
  const [orientation, setOrientation] = useState<PedigreeOrientation>("tb");
  const epicChildSet = useMemo(() => new Set(epicChildKeys), [epicChildKeys]);
  const layout = useMemo(
    () => buildLineageLayout(issuesByKey, rootKey, hideDone),
    [issuesByKey, rootKey, hideDone],
  );
  const geometry = useMemo(
    () => buildPedigreeGeometry(layout, orientation),
    [layout, orientation],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    nodeRefs.current.get(focusKey)?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [focusKey, geometry]);

  if (layout.layers.length === 0) {
    return (
      <div className="jbt-pedigree">
        <p className="jbt-pedigree-empty">Nothing to show in this graph.</p>
      </div>
    );
  }

  const parallelHint =
    orientation === "tb"
      ? "Same row = can work in parallel · lines = blocks"
      : "Same column = can work in parallel · lines = blocks";

  const nodeList = [...geometry.nodes.values()];

  return (
    <div className={`jbt-pedigree jbt-pedigree-${orientation}`}>
      <div className="jbt-pedigree-toolbar">
        <p className="jbt-pedigree-legend">{parallelHint}</p>
        <div className="jbt-pedigree-toolbar-actions">
          <div
            className="jbt-view-toggle"
            role="group"
            aria-label="Pedigree orientation"
          >
            <button
              type="button"
              className={orientation === "tb" ? "jbt-view-toggle-active" : undefined}
              aria-pressed={orientation === "tb"}
              onClick={() => setOrientation("tb")}
              title="Top to bottom"
            >
              Top↓
            </button>
            <button
              type="button"
              className={orientation === "lr" ? "jbt-view-toggle-active" : undefined}
              aria-pressed={orientation === "lr"}
              onClick={() => setOrientation("lr")}
              title="Left to right"
            >
              Left→
            </button>
          </div>
        </div>
      </div>

      <div className="jbt-pedigree-scroll" ref={scrollRef}>
        <div
          className="jbt-pedigree-canvas"
          style={{ width: geometry.width, height: geometry.height }}
        >
          <svg
            className="jbt-pedigree-svg"
            width={geometry.width}
            height={geometry.height}
            aria-hidden
          >
            {geometry.edgePaths.map((edge) => {
              const active = focusKey === edge.from || focusKey === edge.to;
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={edge.d}
                  className={
                    active
                      ? "jbt-pedigree-edge jbt-pedigree-edge-active"
                      : "jbt-pedigree-edge"
                  }
                  fill="none"
                />
              );
            })}
          </svg>

          {geometry.layerLabels.map((label) => (
            <div
              key={label.layerIndex}
              className="jbt-pedigree-layer-label"
              style={{ left: label.x, top: label.y }}
            >
              {label.label}
            </div>
          ))}

          {nodeList.map((box) => {
            const issue = box.issue;
            const isSelected = focusKey === issue.key;
            const isEpicChild = epicChildSet.has(issue.key);
            const isDone = issue.statusCategory === "done";

            return (
              <button
                key={issue.key}
                ref={(el) => {
                  if (el) nodeRefs.current.set(issue.key, el);
                  else nodeRefs.current.delete(issue.key);
                }}
                type="button"
                className={[
                  "jbt-pedigree-node",
                  isSelected ? "jbt-pedigree-node-selected" : "",
                  issue.onCriticalPath ? "jbt-pedigree-node-critical" : "",
                  isDone ? "jbt-pedigree-node-done" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  left: box.x,
                  top: box.y,
                  width: box.w,
                  height: box.h,
                }}
                onClick={() => onFocusKey(issue.key)}
                title={issue.summary}
              >
                <div className="jbt-pedigree-node-top">
                  <a
                    className="jbt-key"
                    href={issueBrowseUrl(issue.key)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {issue.key}
                  </a>
                  <span className="jbt-pedigree-lev" title="Leverage">
                    {issue.leverage}
                  </span>
                </div>
                <span className="jbt-pedigree-summary">{issue.summary}</span>
                <div className="jbt-pedigree-node-meta">
                  <StatusLozenge issue={issue} />
                  <Avatar assignee={issue.assigneeDisplayName} />
                  {isEpicChild && (
                    <span className="jbt-pedigree-badge">epic</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
