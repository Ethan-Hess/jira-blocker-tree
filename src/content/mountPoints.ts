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
 * Insert the launcher slot into the Jira action row, between Automation and
 * Improve Epic when both exist, so it sits on the same wrapped row as those
 * siblings. Returns the slot element, or null when the header has not rendered.
 */
export function ensureLauncherSlot(): HTMLElement | null {
  const existing = document.getElementById(LAUNCHER_SLOT_ID);
  if (existing?.isConnected) return existing;

  const actions = document.querySelector(
    '[data-testid="issue.views.issue-base.foundation.status.actions-wrapper"]',
  );
  const improve = document.querySelector(
    '[data-testid="issue.views.issue-base.foundation.status.improve-issue"]',
  );
  const fallback = findAnchor();
  if (!actions && !improve && !fallback) return null;

  const slot = document.createElement("div");
  slot.id = LAUNCHER_SLOT_ID;
  slot.className = "jbt-launcher-slot";

  if (improve?.parentElement) {
    improve.parentElement.insertBefore(slot, improve);
  } else if (actions) {
    actions.insertAdjacentElement("afterend", slot);
  } else if (fallback) {
    fallback.appendChild(slot);
  }

  return slot;
}

export const LAUNCHER_BUTTON_CLASS = "jbt-launcher-cloned";

/** Tree/hierarchy glyph drawn in the Atlassian 16px icon grid. */
const ICON_SVG = `<svg fill="none" viewBox="0 0 16 16" role="presentation" focusable="false"><path fill="currentcolor" d="M6 2.75A.75.75 0 0 1 6.75 2h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 2.75M2.75 2a.75.75 0 0 0-.75.75v9.5A2.75 2.75 0 0 0 4.75 15h1.5a.75.75 0 0 0 0-1.5h-1.5c-.69 0-1.25-.56-1.25-1.25V8.5h2.5a.75.75 0 0 0 0-1.5H3.5V2.75A.75.75 0 0 0 2.75 2M9 7.75A.75.75 0 0 1 9.75 7h3.5a.75.75 0 0 1 0 1.5h-3.5A.75.75 0 0 1 9 7.75m.75 4.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5z"/></svg>`;

/**
 * Find a sibling header button to copy. Jira compiles its styles into atomic
 * classes that already carry light and dark tokens, so copying a live button
 * is the only way to match it exactly and stay correct when Atlassian
 * changes those class names.
 */
function findDonorButton(): HTMLButtonElement | null {
  // Ordered by preference. The status field lives in the same container and
  // must never be used: it is a lozenge dropdown, styled nothing like these.
  const selectors = [
    // Prefer Agents: it is a labelled button. Automation is icon-only and
    // clips any text we inject into the same padding.
    '[data-testid="ai-agents-button.button"]',
    '[data-testid="issue.views.issue-base.foundation.status.actions-wrapper"] button',
  ];

  const isUsable = (el: Element | null): el is HTMLButtonElement => {
    if (!(el instanceof HTMLButtonElement)) return false;
    if (el.closest(`#${LAUNCHER_SLOT_ID}`)) return false;
    if (el.closest('[data-testid*="status-view"]')) return false;
    if (el.closest('[data-testid="ref-spotlight-target-status-spotlight"]')) {
      return false;
    }
    return Boolean(el.querySelector('span[aria-hidden="true"] svg'));
  };

  for (const selector of selectors) {
    for (const candidate of document.querySelectorAll(selector)) {
      if (isUsable(candidate)) return candidate;
    }
  }

  return null;
}

/**
 * Clone a neighbouring Jira button and retarget it, so the launcher is the
 * same element type with the same classes, padding and typography.
 *
 * Only the button itself is cloned. Outer presentation wrappers vary in height
 * (Agents uses a 44px wrapper; Automation uses 32px), and the launcher slot
 * already supplies the shared 12px bottom padding used by this row.
 */
export function buildLauncherButton(
  label: string,
  onClick: () => void,
): HTMLElement | null {
  const donor = findDonorButton();
  if (!donor) return null;

  const button = donor.cloneNode(true) as HTMLButtonElement;

  for (const attr of [
    "aria-expanded",
    "aria-haspopup",
    "aria-label",
    "aria-live",
    "data-testid",
    "id",
    "style",
    "tabindex",
  ]) {
    button.removeAttribute(attr);
  }
  button.querySelectorAll("[data-testid]").forEach((el) => {
    el.removeAttribute("data-testid");
  });
  button.type = "button";
  button.classList.add(LAUNCHER_BUTTON_CLASS);

  const icon = button.querySelector('span[aria-hidden="true"]');
  if (icon) {
    icon.innerHTML = ICON_SVG;
    icon.setAttribute("style", "color:currentColor");
  }

  // The label span is not always a sibling of the icon: on some buttons the
  // icon sits in its own wrapper and the label follows it. Look for leaf spans
  // carrying text anywhere inside the button instead of assuming a shape.
  const labelSpans = Array.from(button.querySelectorAll("span")).filter(
    (span) =>
      span !== icon &&
      !(icon && span.contains(icon)) &&
      span.childElementCount === 0 &&
      (span.textContent ?? "").trim().length > 0,
  );

  if (labelSpans.length > 0) {
    labelSpans[0].textContent = label;
    labelSpans.slice(1).forEach((span) => span.remove());
  } else {
    button.appendChild(document.createTextNode(label));
  }

  // Drop any leftover text sitting directly on the button.
  for (const node of Array.from(button.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      if (labelSpans.length > 0) node.remove();
    }
  }

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });

  return button;
}

/** The actual button inside whatever wrapper `buildLauncherButton` returned. */
export function launcherButtonEl(root: HTMLElement): HTMLButtonElement | null {
  return root instanceof HTMLButtonElement
    ? root
    : root.querySelector("button");
}

/**
 * Re-run `onAnchorReady` whenever Jira re-renders the issue header, or while
 * the slot is still showing the fallback button and a donor may yet appear.
 */
export function observeHeader(onAnchorReady: () => void): () => void {
  const needsWork = () => {
    const slot = document.getElementById(LAUNCHER_SLOT_ID);
    return !slot?.isConnected || slot.dataset.mounted !== "1";
  };

  const observer = new MutationObserver(() => {
    if (needsWork()) onAnchorReady();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  const interval = window.setInterval(() => {
    if (needsWork()) onAnchorReady();
  }, 1000);

  return () => {
    observer.disconnect();
    window.clearInterval(interval);
  };
}
