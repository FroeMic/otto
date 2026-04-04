"use client";

import { createContext, useContext, useState, useCallback } from "react";

type BreadcrumbSegment = {
  label: string;
  href?: string;
};

type BreadcrumbContextType = {
  segments: BreadcrumbSegment[];
  setSegments: (segments: BreadcrumbSegment[]) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextType>({
  segments: [],
  setSegments: () => {},
});

export function BreadcrumbProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [segments, setSegments] = useState<BreadcrumbSegment[]>([]);

  return (
    <BreadcrumbContext.Provider value={{ segments, setSegments }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbSegments() {
  return useContext(BreadcrumbContext).segments;
}

export function useSetBreadcrumbs() {
  return useContext(BreadcrumbContext).setSegments;
}
