"use client";

import { useState, useTransition } from "react";

// Optimistically hides the card as soon as it's clicked, then fires the
// dismiss Server Action in the background — the caller doesn't wait for a
// round trip to see it disappear. On failure it un-hides rather than
// leaving the item looking gone when it was never actually persisted.
export function useDismissable(action: () => Promise<{ error?: string } | undefined>) {
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();

  function dismiss() {
    setDismissed(true);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setDismissed(false);
    });
  }

  return { dismissed, pending, dismiss };
}
