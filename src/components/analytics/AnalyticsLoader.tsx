"use client";

import { useEffect } from "react";
import { loadAnalytics } from "@/lib/analytics";

/** Mount once in the root layout; no-op off jishuba.cn / non-production. */
export function AnalyticsLoader() {
  useEffect(() => {
    loadAnalytics();
  }, []);
  return null;
}
