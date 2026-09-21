import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BlockerTreePanel,
  resolveInitialIssueKey,
} from "../ui/BlockerTreePanel";

function SidePanelApp() {
  const [issueKey, setIssueKey] = useState<string | null>(null);

  useEffect(() => {
    void resolveInitialIssueKey().then(setIssueKey);
  }, []);

  return <BlockerTreePanel issueKey={issueKey} onIssueKeyChange={setIssueKey} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SidePanelApp />
  </StrictMode>,
);
