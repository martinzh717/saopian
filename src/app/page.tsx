import { LocalWorkspacePage } from "./local-workspace-page";

export const dynamic = "force-dynamic";

/** Local / portable entry. Public static site uses a temporary page swapped by build-web. */
export default async function HomePage() {
  return <LocalWorkspacePage />;
}
