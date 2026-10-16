"use client";

import { useEffect, useState } from "react";

export interface CorpusDoc {
  slug: string;
  title: string;
  authority: string;
  edition: string;
  status: string;
  source_url: string | null;
  ingested_at: string;
  last_verified: string | null;
}

export interface CorpusState {
  loading: boolean;
  failed: boolean;
  documents: CorpusDoc[];
  stale: boolean;
}

let inflight: Promise<{ documents: CorpusDoc[]; stale: boolean }> | null = null;

export function useCorpus(): CorpusState {
  const [state, setState] = useState<CorpusState>({ loading: true, failed: false, documents: [], stale: false });
  useEffect(() => {
    let cancelled = false;
    inflight ??= fetch("/api/corpus").then((r) => {
      if (!r.ok) throw new Error("corpus");
      return r.json();
    });
    inflight
      .then((d) => {
        if (!cancelled) setState({ loading: false, failed: false, documents: d.documents ?? [], stale: !!d.stale });
      })
      .catch(() => {
        inflight = null;
        if (!cancelled) setState({ loading: false, failed: true, documents: [], stale: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
