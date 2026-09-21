import { issueBrowseUrl } from "../shared/issueKey";
import type { IssueSummary } from "../shared/types";
import { PriorityLozenge } from "./PriorityLozenge";

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

interface NeighborCardProps {
  issueKey: string;
  issuesByKey: Record<string, IssueSummary>;
  onFocus: (key: string) => void;
}

function NeighborCard({ issueKey, issuesByKey, onFocus }: NeighborCardProps) {
  const issue = issuesByKey[issueKey];
  if (!issue) {
    return (
      <button
        type="button"
        className="jbt-lineage-card jbt-lineage-card-missing"
        onClick={() => onFocus(issueKey)}
      >
        <span className="jbt-key">{issueKey}</span>
        <span className="jbt-lineage-muted">Not loaded in this graph</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="jbt-lineage-card"
      onClick={() => onFocus(issueKey)}
    >
      <a
        className="jbt-key"
        href={issueBrowseUrl(issue.key)}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {issue.key}
      </a>
      <span className="jbt-lineage-summary" title={issue.summary}>
        {issue.summary}
      </span>
      <div className="jbt-lineage-card-meta">
        <StatusLozenge issue={issue} />
        <span className="jbt-lineage-assignee">
          {issue.assigneeDisplayName ?? "Unassigned"}
        </span>
      </div>
    </button>
  );
}

interface LineageViewProps {
  focusKey: string;
  issuesByKey: Record<string, IssueSummary>;
  onFocusKey: (key: string) => void;
}

export function LineageView({
  focusKey,
  issuesByKey,
  onFocusKey,
}: LineageViewProps) {
  const focus = issuesByKey[focusKey];
  const blockerKeys = focus?.blockerKeys ?? [];
  const blockedKeys = focus?.blockedKeys ?? [];

  return (
    <div className="jbt-lineage">
      <section className="jbt-lineage-section">
        <h2 className="jbt-lineage-heading">Blocked by</h2>
        {blockerKeys.length === 0 ? (
          <p className="jbt-lineage-empty">Nothing blocking this.</p>
        ) : (
          <ul className="jbt-lineage-list">
            {blockerKeys.map((key) => (
              <li key={key}>
                <NeighborCard
                  issueKey={key}
                  issuesByKey={issuesByKey}
                  onFocus={onFocusKey}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="jbt-lineage-connector" aria-hidden>
        <span className="jbt-lineage-connector-label">blocked by</span>
      </div>

      <section className="jbt-lineage-section jbt-lineage-focus">
        <h2 className="jbt-lineage-heading">This ticket</h2>
        {focus ? (
          <div className="jbt-lineage-focus-card">
            <div className="jbt-lineage-focus-top">
              <a
                className="jbt-key"
                href={issueBrowseUrl(focus.key)}
                target="_blank"
                rel="noreferrer"
              >
                {focus.key}
              </a>
              <span className="jbt-lineage-leverage" title="Leverage score">
                {focus.leverage}
              </span>
            </div>
            <p className="jbt-lineage-focus-summary">{focus.summary}</p>
            <div className="jbt-lineage-focus-meta">
              <PriorityLozenge issue={focus} />
              <StatusLozenge issue={focus} />
              <span className="jbt-lineage-assignee">
                {focus.assigneeDisplayName ?? "Unassigned"}
              </span>
            </div>
          </div>
        ) : (
          <p className="jbt-lineage-empty">
            {focusKey} is not loaded in this graph.
          </p>
        )}
      </section>

      <div className="jbt-lineage-connector" aria-hidden>
        <span className="jbt-lineage-connector-label">blocks</span>
      </div>

      <section className="jbt-lineage-section">
        <h2 className="jbt-lineage-heading">Blocks</h2>
        {blockedKeys.length === 0 ? (
          <p className="jbt-lineage-empty">
            Does not block anything in this graph.
          </p>
        ) : (
          <ul className="jbt-lineage-list">
            {blockedKeys.map((key) => (
              <li key={key}>
                <NeighborCard
                  issueKey={key}
                  issuesByKey={issuesByKey}
                  onFocus={onFocusKey}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
