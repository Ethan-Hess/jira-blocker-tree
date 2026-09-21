import type { TreeSortColumn, TreeSortState } from "./sortTree";

interface TreeColumnHeaderProps {
  sort: TreeSortState;
  onSort: (column: TreeSortColumn) => void;
}

const COLUMNS: { id: TreeSortColumn; label: string }[] = [
  { id: "issue", label: "Issue" },
  { id: "leverage", label: "Leverage" },
  { id: "priority", label: "Priority" },
  { id: "status", label: "Status" },
  { id: "assignee", label: "Assignee" },
];

function sortIndicator(active: boolean, dir: TreeSortState["dir"]): string {
  if (!active) return "";
  return dir === "asc" ? " ↑" : " ↓";
}

export function TreeColumnHeader({ sort, onSort }: TreeColumnHeaderProps) {
  return (
    <div className="jbt-tree-header jbt-tree-grid" role="row">
      {COLUMNS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={`jbt-tree-header-cell jbt-col-${id}${
            sort.column === id ? " jbt-tree-header-active" : ""
          }`}
          onClick={() => onSort(id)}
        >
          {label}
          {sortIndicator(sort.column === id, sort.dir)}
        </button>
      ))}
    </div>
  );
}
