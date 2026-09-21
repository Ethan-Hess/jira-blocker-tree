import { useEffect, useState } from "react";

export type ColorMode = "light" | "dark";

function readJiraColorMode(): ColorMode | null {
  const attr = document.documentElement.getAttribute("data-color-mode");
  if (attr === "dark" || attr === "light") return attr;
  return null;
}

function currentMode(): ColorMode {
  const fromJira = readJiraColorMode();
  if (fromJira) return fromJira;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Follows Jira's own theme when running in the content script, and the OS
 * preference in the side panel where Jira's attributes are not present.
 */
export function useColorMode(): ColorMode {
  const [mode, setMode] = useState<ColorMode>(currentMode);

  useEffect(() => {
    const update = () => setMode(currentMode());

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-color-mode", "data-theme"],
    });

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener("change", update);

    return () => {
      observer.disconnect();
      media?.removeEventListener("change", update);
    };
  }, []);

  return mode;
}
