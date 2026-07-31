import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthShell>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Sign In</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Welcome back — sign in to continue.
      </p>
      <div className="mt-8">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </AuthShell>
  );
}
