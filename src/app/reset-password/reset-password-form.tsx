"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { AuthShell } from "@/components/auth/auth-shell";
import { updatePassword, type ResetPasswordState } from "./actions";

export function ResetPasswordForm({ required = false }: { required?: boolean }) {
  const [state, action, pending] = useActionState<ResetPasswordState, FormData>(
    updatePassword,
    undefined
  );

  return (
    <AuthShell>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Set a new password
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {required
          ? "Your account is using a temporary password. Choose your own password to continue."
          : "Choose a new password for your account."}
      </p>
      <div className="mt-8">
        <form action={action}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="password">New password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                className="h-11 rounded-xl px-3.5"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                className="h-11 rounded-xl px-3.5"
              />
            </Field>
            {state?.error && (
              <FieldDescription className="text-destructive">
                {state.error}
              </FieldDescription>
            )}
            <Button type="submit" disabled={pending} className="h-11 w-full rounded-xl text-base">
              {pending ? "Saving..." : "Save password"}
            </Button>
          </FieldGroup>
        </form>
      </div>
    </AuthShell>
  );
}
