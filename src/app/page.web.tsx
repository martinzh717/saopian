import { PublicWorkspacePage } from "@/components/workspace/PublicWorkspacePage";

export const dynamic = "force-static";

/** Copied over page.tsx during `pnpm build:web`. Same workspace UI as local; help via top-right ?. */
export default function HomePage() {
  return <PublicWorkspacePage />;
}
