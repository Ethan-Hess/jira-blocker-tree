import { StrictMode, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BlockerTreePanel } from "../ui/BlockerTreePanel";
import { issueKeyFromUrl } from "../shared/issueKey";
import { TreeIcon } from "../ui/icons";
import panelCss from "../ui/panel.css?inline";
import {
  PANEL_HOST_ID,
  ensureLauncherSlot,
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

function LauncherButton() {
  const [open, setOpen] = useOpenState();

  return (
    <button
      type="button"
      className="jbt-launcher-button"
      aria-pressed={open}
      title="Show the blocking tree for this issue"
      onClick={() => setOpen(!open)}
    >
      <TreeIcon />
      Blockers
    </button>
  );
}

function DrawerApp() {
  const issueKey = useIssueKeyFromPage();
  const [open, setOpen] = useOpenState();

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

function mountLauncher() {
  const slot = ensureLauncherSlot();
  if (!slot || slot.dataset.mounted === "1") return;

  slot.dataset.mounted = "1";
  launcherRoot?.unmount();
  launcherRoot = createRoot(slot);
  launcherRoot.render(
    <StrictMode>
      <LauncherButton />
    </StrictMode>,
  );
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
