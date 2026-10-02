import { Workspace } from "@/components/workspace/Workspace";
import { browseDirectory } from "@/lib/media/list-media";
import { PathGuardError } from "@/lib/media/path-guard";
import { getDefaultMediaRoot } from "@/lib/media/default-directory";

/** Local / portable homepage — not used in the public static export. */
export async function LocalWorkspacePage() {
  let initialBrowse = null;
  let initialError: string | null = null;

  try {
    initialBrowse = await browseDirectory(getDefaultMediaRoot());
  } catch (err) {
    initialError =
      err instanceof PathGuardError
        ? err.message
        : err instanceof Error
          ? err.message
          : "无法打开默认目录";
  }

  return (
    <Workspace
      defaultMediaPath={getDefaultMediaRoot()}
      initialBrowse={initialBrowse}
      initialError={initialError}
    />
  );
}
