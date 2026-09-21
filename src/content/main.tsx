import { StrictMode, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BlockerTreePanel } from "../ui/BlockerTreePanel";
import { issueKeyFromUrl } from "../shared/issueKey";
import { TreeIcon } from "../ui/icons";
import panelCss from "../ui/panel.css?inline";
import {
  PANEL_HOST_ID,
  buildLauncherButton,
  ensureLauncherSlot,
  launcherButtonEl,
  observeHeader,
} from "./mountPoints";
import "./content.css";

const OPEN_STATE_KEY = "jbt-panel-open";

/** Panel open/closed state shared between the launcher and the drawer roots. */
const openState = {
  value: sessionStorage.getItem(OPEN_STATE_KEY) === "1",
  listeners: new Set<(open: boolean) => void>(),
  set(next: boolean) {
    this.value = next;
    sessionStorage.setItem(OPEN_STATE_KEY, next ? "1" : "0");
    this.listeners.forEach((listener) => listener(next));
  },
};

function useOpenState(): [boolean, (next: boolean) => void] {
  const [open, setOpen] = useState(openState.value);
  useEffect(() => {
    const listener = (next: boolean) => setOpen(next);
    openState.listeners.add(listener);
    return () => {
      openState.listeners.delete(listener);
    };
  }, []);
  return [open, (next: boolean) => openState.set(next)];
}

function useIssueKeyFromPage(): string | null {
  const [issueKey, setIssueKey] = useState(() =>
    issueKeyFromUrl(window.location.href),
  );

  useEffect(() => {
    let current = issueKey;

    const sync = () => {
      const key = issueKeyFromUrl(window.location.href);
      if (key === current) return;
      current = key;
      setIssueKey(key);
      if (key) {
        chrome.runtime
          .sendMessage({ type: "SET_ACTIVE_ISSUE", issueKey: key })
          .catch(() => undefined);
      }
    };

    const interval = window.setInterval(sync, 1000);
    window.addEventListener("popstate", sync);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("popstate", sync);
    };
  }, [issueKey]);

  return issueKey;
}

/** Fallback button, used only when no Jira button is available to clone. */
function FallbackLauncher() {
  const [open, setOpen] = useOpenState();
  return (
    <button
      type="button"
      className="jbt-launcher-button"
      data-jbt-open={open}
      title={open ? "Hide the blocking tree" : "Show the blocking tree"}
      onClick={() => setOpen(!open)}
    >
      <TreeIcon />
      Blockers
    </button>
  );
}

function syncLauncherState(button: HTMLButtonElement, open: boolean) {
  button.dataset.jbtOpen = open ? "true" : "false";
  button.title = open ? "Hide the blocking tree" : "Show the blocking tree";
}

function DrawerApp() {
  const issueKey = useIssueKeyFromPage();
  const [open, setOpen] = useOpenState();

  useEffect(() => {
    document.documentElement.classList.toggle("jbt-drawer-open", open);
    return () => {
      document.documentElement.classList.remove("jbt-drawer-open");
    };
  }, [open]);

  if (!open) return null;
  return (
    <BlockerTreePanel
      issueKey={issueKey}
      variant="drawer"
      onClose={() => setOpen(false)}
    />
  );
}

function mountPanelHost() {
  if (document.getElementById(PANEL_HOST_ID)) return;

  const host = document.createElement("div");
  host.id = PANEL_HOST_ID;
  document.body.appendChild(host);

  // Shadow DOM keeps Jira's global styles from leaking into the panel.
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = panelCss;
  shadow.appendChild(style);

  const mountEl = document.createElement("div");
  shadow.appendChild(mountEl);

  createRoot(mountEl).render(
    <StrictMode>
      <DrawerApp />
    </StrictMode>,
  );
}

let launcherRoot: Root | null = null;
let unsubscribeLauncher: (() => void) | null = null;

function mountLauncher() {
  const slot = ensureLauncherSlot();
  if (!slot || slot.dataset.mounted === "1") return;

  const root = buildLauncherButton("Blockers", () => {
    openState.set(!openState.value);
  });
  const button = root ? launcherButtonEl(root) : null;

  if (root && button) {
    unsubscribeLauncher?.();
    unsubscribeLauncher = null;
    // Drop the fallback React tree before taking over the slot imperatively.
    launcherRoot?.unmount();
    launcherRoot = null;

    slot.dataset.mounted = "1";
    slot.replaceChildren(root);
    syncLauncherState(button, openState.value);

    const listener = (open: boolean) => syncLauncherState(button, open);
    openState.listeners.add(listener);
    unsubscribeLauncher = () => openState.listeners.delete(listener);
    return;
  }

  // Jira's header buttons have not rendered yet; show the fallback and let the
  // header observer retry so the cloned button can replace it.
  if (!launcherRoot) {
    launcherRoot = createRoot(slot);
    launcherRoot.render(
      <StrictMode>
        <FallbackLauncher />
      </StrictMode>,
    );
  }
}

function start() {
  mountPanelHost();
  mountLauncher();
  observeHeader(mountLauncher);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
