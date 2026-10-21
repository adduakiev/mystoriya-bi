import type { ReactNode } from "react";

// Authenticated RPC data is loaded on request, never during a credential-free build.
// Explicit unstable_cache entries in the data layer still provide server caching.
export const dynamic = "force-dynamic";

export default function DigitalLayout({ children }: { children: ReactNode }) {
  return children;
}
