"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { AuthShell } from "@/components/auth/auth-shell";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordReset,
    undefined
  );

  return (
    <AuthShell>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Reset your password
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter your email and we&apos;ll send you a link to reset it.
      </p>
      <div className="mt-8">
        {state?.success ? (
          <FieldDescription>
            If an account exists for that email, we&apos;ve sent a link to reset your
            password. Check your inbox (and spam folder).
          </FieldDescription>
        ) : (
          <form action={action}>
            <FieldGroup>
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
              {state?.error && (
                <FieldDescription className="text-destructive">
                  {state.error}
                </FieldDescription>
              )}
              <Button type="submit" disabled={pending} className="h-11 w-full rounded-xl text-base">
                {pending ? "Sending..." : "Send reset link"}
              </Button>
            </FieldGroup>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
