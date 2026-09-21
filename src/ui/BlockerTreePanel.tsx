import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getActiveIssueKey, requestBuildTree } from "../shared/messaging";
import { issueKeyFromUrl } from "../shared/issueKey";
import type { BuildTreeResult, TreeNode } from "../shared/types";
import { TreeNodeRow } from "./TreeNodeRow";
import { CloseIcon, RefreshIcon } from "./icons";
import "./panel.css";

function filterTree(node: TreeNode, hideDone: boolean): TreeNode | null {
  if (hideDone && node.issue.statusCategory === "done" && node.kind !== "root") {
    return null;
  }

  const children = node.children
    .map((child) => filterTree(child, hideDone))
    .filter((child): child is TreeNode => child !== null);

  return { ...node, children };
}

function countNodes(node: TreeNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

function Skeleton() {
  return (
    <div className="jbt-skeleton">
      {[90, 70, 78, 55, 66, 48].map((width, i) => (
        <div
          key={i}
          className="jbt-skeleton-row"
          style={{ width: `${width}%`, marginLeft: i % 3 === 0 ? 0 : 16 }}
        />
      ))}
    </div>
  );
}

interface BlockerTreePanelProps {
  issueKey: string | null;
  onClose?: () => void;
  onIssueKeyChange?: (key: string | null) => void;
  variant?: "drawer" | "embedded";
}

export function BlockerTreePanel({
  issueKey,
  onClose,
  onIssueKeyChange,
  variant = "embedded",
}: BlockerTreePanelProps) {
  const [inputKey, setInputKey] = useState(issueKey ?? "");
  const [hideDone, setHideDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BuildTreeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedKeyRef = useRef<string | null>(null);

  const load = useCallback(
    async (key: string, force = false) => {
      const trimmed = key.trim().toUpperCase();
      if (!trimmed) return;

      setLoading(true);
      setError(null);
      try {
        const data = await requestBuildTree(trimmed, force);
        setResult(data);
        setError(data.error ?? null);
        loadedKeyRef.current = trimmed;
        onIssueKeyChange?.(trimmed);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load tree");
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [onIssueKeyChange],
  );

  useEffect(() => {
    if (!issueKey) return;
    setInputKey(issueKey);
    if (loadedKeyRef.current === issueKey) return;
    void load(issueKey);
  }, [issueKey, load]);

  const displayTree = useMemo(
    () => (result?.tree ? filterTree(result.tree, hideDone) : null),
    [result?.tree, hideDone],
  );

  const rootKey = result?.rootKey ?? issueKey;
  const visibleCount = displayTree ? countNodes(displayTree) : 0;

  const body = (
    <div className="jbt-root jbt-embedded">
      <header className="jbt-header">
        <div className="jbt-header-text">
          <h1 className="jbt-title">Blocker tree</h1>
          <p className="jbt-subtitle">
            {rootKey ? `${rootKey} · epic children and blockers` : "No issue selected"}
          </p>
        </div>
        <button
          type="button"
          className="jbt-icon-button"
          title="Refresh"
          disabled={loading || !rootKey}
          onClick={() => rootKey && void load(rootKey, true)}
        >
          <span className={loading ? "jbt-spin" : undefined}>
            <RefreshIcon />
          </span>
        </button>
        {onClose && (
          <button
            type="button"
            className="jbt-icon-button"
            title="Close"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        )}
      </header>

      <div className="jbt-toolbar">
        <form
          className="jbt-field"
          onSubmit={(e) => {
            e.preventDefault();
            void load(inputKey, true);
          }}
        >
          <input
            className="jbt-input"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="Issue key, e.g. ISSUE-KEY"
            spellCheck={false}
          />
        </form>
        <label className="jbt-checkbox">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
          />
          Hide done
        </label>
      </div>

      {error && <div className="jbt-banner jbt-banner-error">{error}</div>}

      {result?.truncated && !error && (
        <div className="jbt-banner jbt-banner-warn">
          Graph truncated at the depth or node limit. Some blockers are hidden.
        </div>
      )}

      {result && !loading && !error && (
        <div className="jbt-meta">
          {result.nodeCount} issue{result.nodeCount === 1 ? "" : "s"} loaded ·{" "}
          {visibleCount} shown
        </div>
      )}

      <div className="jbt-tree">
        {loading && <Skeleton />}
        {!loading && displayTree && <TreeNodeRow node={displayTree} depth={0} />}
        {!loading && !displayTree && !error && (
          <p className="jbt-empty">
            {issueKey
              ? "Nothing to show for this issue."
              : "Open a Jira issue, or enter an issue key above."}
          </p>
        )}
      </div>
    </div>
  );

  if (variant === "drawer") {
    return <div className="jbt-root jbt-drawer">{body}</div>;
  }
  return body;
}

export async function resolveInitialIssueKey(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    const fromTab = issueKeyFromUrl(tab.url);
    if (fromTab) return fromTab;
  }
  return getActiveIssueKey();
}
