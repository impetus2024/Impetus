"use client";

import { startTransition } from "react";

// Drop-in replacement for <form action={fn}>. React 19 resets every
// uncontrolled field after a function action finishes, even when the action
// returned a validation error — the user then has to retype the whole form.
// Submitting through onSubmit (and dispatching inside a transition, which
// keeps `pending` working for useActionState/useTransition callers) skips
// that automatic reset, so a failed submit keeps what was typed and only the
// error message appears. Native `required` validation still runs first.
export function ActionForm({
  action,
  ...props
}: Omit<React.ComponentProps<"form">, "action" | "onSubmit"> & {
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      {...props}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(
          event.currentTarget,
          (event.nativeEvent as SubmitEvent).submitter
        );
        startTransition(() => action(formData));
      }}
    />
  );
}
