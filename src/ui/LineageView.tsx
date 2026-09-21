import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildLineageLayout, layerLabel } from "../shared/lineageLayers";
import { issueBrowseUrl } from "../shared/issueKey";
import type { IssueSummary } from "../shared/types";

interface MeasuredEdge {
  from: string;
  to: string;
  path: string;
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

function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
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
  const epicChildSet = useMemo(() => new Set(epicChildKeys), [epicChildKeys]);
  const layout = useMemo(
    () => buildLineageLayout(issuesByKey, rootKey, hideDone),
    [issuesByKey, rootKey, hideDone],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [measuredEdges, setMeasuredEdges] = useState<MeasuredEdge[]>([]);

  const setNodeRef = useCallback((key: string) => {
    return (el: HTMLButtonElement | null) => {
      if (el) nodeRefs.current.set(key, el);
      else nodeRefs.current.delete(key);
    };
  }, []);

  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    const scrollEl = scrollRef.current;
    if (!canvas) return;

    setCanvasSize({
      width: canvas.scrollWidth,
      height: canvas.scrollHeight,
    });

    const canvasRect = canvas.getBoundingClientRect();
    const scrollLeft = scrollEl?.scrollLeft ?? 0;
    const scrollTop = scrollEl?.scrollTop ?? 0;
    const next: MeasuredEdge[] = [];

    for (const edge of layout.edges) {
      const fromEl = nodeRefs.current.get(edge.from);
      const toEl = nodeRefs.current.get(edge.to);
      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left + scrollLeft;
      const y1 = fromRect.bottom - canvasRect.top + scrollTop;
      const x2 = toRect.left + toRect.width / 2 - canvasRect.left + scrollLeft;
      const y2 = toRect.top - canvasRect.top + scrollTop;

      next.push({
        from: edge.from,
        to: edge.to,
        path: elbowPath(x1, y1, x2, y2),
      });
    }

    setMeasuredEdges(next);
  }, [layout.edges]);

  useLayoutEffect(() => {
    measure();
  }, [measure, layout, focusKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scrollEl = scrollRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => measure());
    observer.observe(canvas);
    scrollEl?.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      scrollEl?.removeEventListener("scroll", measure);
    };
  }, [measure]);

  useEffect(() => {
    const el = nodeRefs.current.get(focusKey);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusKey, layout]);

  const focusRoot = () => {
    onFocusKey(rootKey);
    requestAnimationFrame(() => {
      nodeRefs.current.get(rootKey)?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    });
  };

  if (layout.layers.length === 0) {
    return (
      <div className="jbt-pedigree">
        <p className="jbt-pedigree-empty">Nothing to show in this graph.</p>
      </div>
    );
  }

  return (
    <div className="jbt-pedigree">
      <div className="jbt-pedigree-toolbar">
        <p className="jbt-pedigree-legend">
          Same row = can work in parallel · lines = blocks
        </p>
        {focusKey !== rootKey && (
          <button type="button" className="jbt-pedigree-root" onClick={focusRoot}>
            Root
          </button>
        )}
      </div>

      <div className="jbt-pedigree-scroll" ref={scrollRef}>
        <div className="jbt-pedigree-canvas" ref={canvasRef}>
          <svg
            className="jbt-pedigree-svg"
            width={canvasSize.width}
            height={canvasSize.height}
            aria-hidden
          >
            {measuredEdges.map((edge) => {
              const active = focusKey === edge.from || focusKey === edge.to;
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={edge.path}
                  className={
                    active ? "jbt-pedigree-edge jbt-pedigree-edge-active" : "jbt-pedigree-edge"
                  }
                  fill="none"
                />
              );
            })}
          </svg>

          {layout.layers.map((row) => (
            <div
              key={row.layerIndex}
              className={`jbt-pedigree-layer${
                row.layerIndex % 2 === 0 ? " jbt-pedigree-layer-alt" : ""
              }`}
            >
              <div className="jbt-pedigree-layer-label">{layerLabel(row.layerIndex)}</div>
              <div className="jbt-pedigree-layer-row">
                {row.issues.map((issue) => {
                  const isSelected = focusKey === issue.key;
                  const isRoot = issue.key === rootKey;
                  const isEpicChild = epicChildSet.has(issue.key);
                  const isDone = issue.statusCategory === "done";

                  return (
                    <button
                      key={issue.key}
                      ref={setNodeRef(issue.key)}
                      type="button"
                      className={[
                        "jbt-pedigree-node",
                        isSelected ? "jbt-pedigree-node-selected" : "",
                        issue.onCriticalPath ? "jbt-pedigree-node-critical" : "",
                        isDone ? "jbt-pedigree-node-done" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
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
                        {isRoot && <span className="jbt-pedigree-badge">root</span>}
                        {isEpicChild && !isRoot && (
                          <span className="jbt-pedigree-badge">epic</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
