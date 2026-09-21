import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getActiveIssueKey, requestBuildTree } from "../shared/messaging";
import { issueKeyFromUrl } from "../shared/issueKey";
import type { BuildTreeResult, TreeNode } from "../shared/types";
import { LineageView } from "./LineageView";
import { TreeColumnHeader } from "./TreeColumnHeader";
import { TreeNodeRow } from "./TreeNodeRow";
import {
  DEFAULT_TREE_SORT,
  sortTree,
  toggleTreeSort,
  type TreeSortState,
} from "./sortTree";
import { CloseIcon, RefreshIcon } from "./icons";
import { useColorMode } from "./useColorMode";
import "./panel.css";

type PanelView = "tree" | "lineage";

const DRAWER_WIDTH_TREE = "520px";
const DRAWER_WIDTH_LINEAGE = "min(920px, 92vw)";

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
  const [view, setView] = useState<PanelView>("tree");
  const [treeSort, setTreeSort] = useState<TreeSortState>(DEFAULT_TREE_SORT);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BuildTreeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedKeyRef = useRef<string | null>(null);
  const colorMode = useColorMode();
  const themeClass = colorMode === "dark" ? " jbt-theme-dark" : "";

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
        setSelectedKey(trimmed);
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

  const toggleSelectedKey = useCallback((key: string) => {
    setSelectedKey((current) => (current === key ? null : key));
  }, []);

  useEffect(() => {
    if (!issueKey) return;
    setInputKey(issueKey);
    if (loadedKeyRef.current === issueKey) return;
    void load(issueKey);
  }, [issueKey, load]);

  useEffect(() => {
    if (variant !== "drawer") return;
    const width = view === "lineage" ? DRAWER_WIDTH_LINEAGE : DRAWER_WIDTH_TREE;
    document.documentElement.style.setProperty("--jbt-drawer-width", width);
    return () => {
      document.documentElement.style.removeProperty("--jbt-drawer-width");
    };
  }, [variant, view]);

  const displayTree = useMemo(() => {
    if (!result?.tree) return null;
    const filtered = filterTree(result.tree, hideDone);
    if (!filtered) return null;
    return sortTree(filtered, treeSort);
  }, [result?.tree, hideDone, treeSort]);

  const rootKey = result?.rootKey ?? issueKey;
  const visibleCount = displayTree ? countNodes(displayTree) : 0;
  const lineageFocusKey = selectedKey ?? rootKey ?? "";

  const body = (
    <div className={`jbt-root jbt-embedded${themeClass}`}>
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
        <div className="jbt-view-toggle" role="tablist" aria-label="View mode">
          <button
            type="button"
            role="tab"
            aria-selected={view === "tree"}
            className={view === "tree" ? "jbt-view-toggle-active" : undefined}
            onClick={() => setView("tree")}
          >
            Tree
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "lineage"}
            className={view === "lineage" ? "jbt-view-toggle-active" : undefined}
            onClick={() => setView("lineage")}
          >
            Lineage
          </button>
        </div>
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
          {selectedKey && view === "lineage" ? ` · focus ${selectedKey}` : ""}
        </div>
      )}

      <div className="jbt-main">
        {loading && <Skeleton />}
        {!loading && view === "tree" && displayTree && (
          <>
            <TreeColumnHeader
              sort={treeSort}
              onSort={(column) =>
                setTreeSort((current) => toggleTreeSort(current, column))
              }
            />
            <div className="jbt-tree">
              <TreeNodeRow
                node={displayTree}
                depth={0}
                selectedKey={selectedKey}
                onSelect={toggleSelectedKey}
              />
            </div>
          </>
        )}
        {!loading && view === "lineage" && result && lineageFocusKey && (
          <LineageView
            focusKey={lineageFocusKey}
            rootKey={result.rootKey}
            epicChildKeys={result.epicChildKeys}
            issuesByKey={result.issuesByKey}
            hideDone={hideDone}
            onFocusKey={toggleSelectedKey}
          />
        )}
        {!loading && !displayTree && !error && view === "tree" && (
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
    const wideClass = view === "lineage" ? " jbt-drawer-wide" : "";
    return (
      <div className={`jbt-root jbt-drawer${wideClass}${themeClass}`}>{body}</div>
    );
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
