import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BlockerTreePanel,
  resolveInitialIssue,
} from "../ui/BlockerTreePanel";

function SidePanelApp() {
  const [issueKey, setIssueKey] = useState<string | null>(null);
  const [jiraOrigin, setJiraOrigin] = useState<string | null>(null);

  useEffect(() => {
    void resolveInitialIssue().then(({ issueKey: key, origin }) => {
      setIssueKey(key);
      setJiraOrigin(origin);
    });
  }, []);

  return (
    <BlockerTreePanel
      issueKey={issueKey}
      jiraOrigin={jiraOrigin}
      onIssueKeyChange={setIssueKey}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SidePanelApp />
  </StrictMode>,
);
