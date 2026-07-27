"use client";

import { useState, useTransition } from "react";

type ErrorState = { error?: string } | undefined;

// Runs a Server Action manually (via useTransition, not useActionState) so
// the dialog can be closed as part of the same transition on success —
// closing via a useEffect that watches the returned state is flagged by
// react-hooks/set-state-in-effect and causes an extra render pass.
export function useDialogFormAction<State extends ErrorState>(
  action: (prev: State, formData: FormData) => Promise<State>,
  onSuccess?: () => void
) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>(undefined as State);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await action(state, formData);
      setState(result);
      if (!result?.error) {
        setOpen(false);
        onSuccess?.();
      }
    });
  }

  return { open, setOpen, pending, state, submit };
}
