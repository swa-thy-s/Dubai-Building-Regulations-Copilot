"use client";

import { useCallback, useSyncExternalStore } from "react";
import { LEGAL_VERSION } from "@/lib/legal";

const KEY = "legal_ack_version";
const EVENT = "legal-ack-change";

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

// Without working storage the acknowledgement is held in memory for this page view.
let memoryAck: string | null = null;

export type AckStatus = "unknown" | "needed" | "ok";

export function useLegalAck(): { status: AckStatus; accept: () => void } {
  const stored = useSyncExternalStore(
    subscribe,
    () => read() ?? memoryAck ?? "",
    () => null,
  );
  const accept = useCallback(() => {
    memoryAck = LEGAL_VERSION;
    try {
      window.localStorage.setItem(KEY, LEGAL_VERSION);
    } catch {
      // storage blocked: memory fallback above keeps this page view working
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  const status: AckStatus = stored === null ? "unknown" : stored === LEGAL_VERSION ? "ok" : "needed";
  return { status, accept };
}
