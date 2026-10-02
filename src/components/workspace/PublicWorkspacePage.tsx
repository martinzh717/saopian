"use client";

import { Workspace } from "@/components/workspace/Workspace";

/** Public static site entry: same workspace UI, empty until user drops a folder or runs the local app. */
export function PublicWorkspacePage() {
  return <Workspace defaultMediaPath="web" initialBrowse={null} initialError={null} />;
}
