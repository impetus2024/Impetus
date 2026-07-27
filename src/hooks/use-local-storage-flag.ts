"use client";

import { useCallback, useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

// Reads a boolean flag from localStorage without a hydration mismatch: the
// server snapshot always matches the default (SSR has no localStorage), and
// useSyncExternalStore — not a state-setting effect — is the pattern React
// itself recommends for external mutable state like this.
export function useLocalStorageFlag(key: string, defaultValue: boolean) {
  const getSnapshot = useCallback(
    () => localStorage.getItem(key) === "1",
    [key]
  );
  const getServerSnapshot = useCallback(() => defaultValue, [defaultValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: boolean) => {
      localStorage.setItem(key, next ? "1" : "0");
      window.dispatchEvent(new StorageEvent("storage"));
    },
    [key]
  );

  return [value, setValue] as const;
}
