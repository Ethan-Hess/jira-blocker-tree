export const LAUNCHER_SLOT_ID = "jbt-launcher-slot";
export const PANEL_HOST_ID = "jbt-panel-host";

/**
 * Jira's issue header action row. The Automation button lives in the actions
 * wrapper, so the launcher sits next to it rather than floating over the page.
 */
const ANCHOR_SELECTORS = [
  '[data-testid="issue.views.issue-base.foundation.status.actions-wrapper"]',
  '[data-testid="issue.views.issue-base.context.status-and-approvals-wrapper.status-and-approval"]',
  '[data-testid="ref-spotlight-target-status-and-approval-spotlight"]',
];

function findAnchor(): Element | null {
  for (const selector of ANCHOR_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

/**
 * Insert the launcher slot into the Jira action row. Returns the slot element,
 * or null when the header has not rendered yet.
 */
export function ensureLauncherSlot(): HTMLElement | null {
  const existing = document.getElementById(LAUNCHER_SLOT_ID);
  if (existing?.isConnected) return existing;

  const anchor = findAnchor();
  if (!anchor) return null;

  const slot = existing ?? document.createElement("div");
  slot.id = LAUNCHER_SLOT_ID;
  slot.className = "jbt-launcher-slot";

  const isActionsWrapper = anchor.matches(
    '[data-testid="issue.views.issue-base.foundation.status.actions-wrapper"]',
  );

  if (isActionsWrapper) {
    anchor.insertAdjacentElement("afterend", slot);
  } else {
    anchor.appendChild(slot);
  }

  return slot;
}

/** Re-run `onAnchorReady` whenever Jira re-renders the issue header. */
export function observeHeader(onAnchorReady: () => void): () => void {
  const observer = new MutationObserver(() => {
    const slot = document.getElementById(LAUNCHER_SLOT_ID);
    if (!slot?.isConnected) {
      onAnchorReady();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  const interval = window.setInterval(() => {
    const slot = document.getElementById(LAUNCHER_SLOT_ID);
    if (!slot?.isConnected) onAnchorReady();
  }, 1000);

  return () => {
    observer.disconnect();
    window.clearInterval(interval);
  };
}
