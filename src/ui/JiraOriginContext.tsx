import { createContext, useContext, type ReactNode } from "react";

const JiraOriginContext = createContext<string | null>(null);

export function JiraOriginProvider({
  origin,
  children,
}: {
  origin: string | null;
  children: ReactNode;
}) {
  return (
    <JiraOriginContext.Provider value={origin}>
      {children}
    </JiraOriginContext.Provider>
  );
}

export function useJiraOrigin(): string | null {
  return useContext(JiraOriginContext);
}
