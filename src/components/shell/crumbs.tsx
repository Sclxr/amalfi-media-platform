"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CrumbContext = createContext<{
  labels: Record<string, string>;
  setLabel: (id: string, label: string) => void;
} | null>(null);

export function CrumbProvider({ children }: { children: React.ReactNode }) {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const value = useMemo(
    () => ({
      labels,
      setLabel: (id: string, label: string) => {
        setLabels((current) => (current[id] === label ? current : { ...current, [id]: label }));
      },
    }),
    [labels],
  );
  return <CrumbContext.Provider value={value}>{children}</CrumbContext.Provider>;
}

export function useCrumbLabels() {
  return useContext(CrumbContext)?.labels ?? {};
}

export function SetCrumb({ id, label }: { id: string; label: string }) {
  const setLabel = useContext(CrumbContext)?.setLabel;
  useEffect(() => {
    setLabel?.(id, label);
  }, [id, label, setLabel]);
  return null;
}
