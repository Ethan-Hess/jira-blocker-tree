import type { IssueSummary } from "../shared/types";

function priorityClass(name: string | null): string {
  if (!name) return "jbt-priority-none";
  const lower = name.toLowerCase();
  if (lower.includes("highest")) return "jbt-priority-highest";
  if (lower === "high") return "jbt-priority-high";
  if (lower.includes("medium")) return "jbt-priority-medium";
  if (lower === "low") return "jbt-priority-low";
  if (lower.includes("lowest")) return "jbt-priority-lowest";
  return "jbt-priority-medium";
}

export function PriorityLozenge({ issue }: { issue: IssueSummary }) {
  if (!issue.priorityName) return null;
  return (
    <span
      className={`jbt-lozenge jbt-priority ${priorityClass(issue.priorityName)}`}
      title={`Priority: ${issue.priorityName}`}
    >
      {issue.priorityName}
    </span>
  );
}
