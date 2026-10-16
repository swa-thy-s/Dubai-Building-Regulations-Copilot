"use client";

import { STRINGS } from "@/lib/legal";
import { useCorpus } from "./useCorpus";

export default function StaleBanner() {
  const { stale, loading } = useCorpus();
  if (loading || !stale) return null;
  return (
    <p role="status" className="mb-4 rounded-lg border border-[var(--warning)] bg-[var(--warning)]/10 p-3 text-xs text-[var(--foreground)]">
      {STRINGS["stale.banner"]}
    </p>
  );
}
