"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { login, type LoginState } from "./actions";
import { ACCOUNT_DISABLED_MESSAGE } from "./constants";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined
  );
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const linkExpired = searchParams.get("error") === "invalid-reset-link";

  const disabled =
    searchParams.get("disabled") === "1" || state?.error === ACCOUNT_DISABLED_MESSAGE;
  const [disabledDialogOpen, setDisabledDialogOpen] = useState(disabled);
  // Re-open on every new disabled result (redirect or a fresh failed
  // submit), even if the user already dismissed it once.
  useEffect(() => {
    if (disabled) setDisabledDialogOpen(true);
  }, [disabled, state]);

  return (
    <>
      <form action={action}>
        <FieldGroup>
          {next && <input type="hidden" name="next" value={next} />}
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-11 rounded-xl px-3.5"
            />
          </Field>
          <Field>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Password"
              aria-label="Password"
              className="h-11 rounded-xl px-3.5"
            />
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
          </Field>
          {linkExpired && (
            <FieldDescription className="text-destructive">
              That reset link is invalid or has expired. Request a new one below.
            </FieldDescription>
          )}
          {state?.error && state.error !== ACCOUNT_DISABLED_MESSAGE && (
            <FieldDescription className="text-destructive">{state.error}</FieldDescription>
          )}
          <Button type="submit" disabled={pending} className="h-11 w-full rounded-xl text-base">
            {pending ? "Signing in..." : "Sign In"}
          </Button>
        </FieldGroup>
      </form>
      <Dialog open={disabledDialogOpen} onOpenChange={setDisabledDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Account disabled</DialogTitle>
            <DialogDescription>{ACCOUNT_DISABLED_MESSAGE}</DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
}
