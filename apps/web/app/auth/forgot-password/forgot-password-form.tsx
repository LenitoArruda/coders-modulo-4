"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useActionState, useEffect, useRef } from "react";

import { createInitialForgotPasswordState } from "../../../lib/auth/forgot-password";
import { AUTH_SIGN_IN_PATH } from "../../../lib/auth/route-rules";
import { AuthLink } from "../_components/auth-card";

import { forgotPasswordAction } from "./actions";

const INPUT_CLASS_NAME =
  "mt-2 h-11 w-full rounded-md border bg-background px-3 text-base text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    forgotPasswordAction,
    createInitialForgotPasswordState(),
  );
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "error") {
      summaryRef.current?.focus();
    }
  }, [state]);

  if (state.status === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-success-border bg-success p-4 text-success-foreground"
      >
        <p className="text-base font-medium">{state.message}</p>
        <p className="mt-2 text-sm leading-relaxed">
          If the account exists, open the link in the email to choose a new
          password. The link expires in 1 hour.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Remembered your password?{" "}
          <AuthLink href={AUTH_SIGN_IN_PATH}>Sign in</AuthLink>.
        </p>
      </div>
    );
  }

  const error = state.fieldErrors.email;
  const describedBy = error ? "forgot-password-email-error" : undefined;

  return (
    <form
      action={formAction}
      noValidate
      aria-busy={isPending}
      className="space-y-5 text-sm text-foreground"
    >
      <p className="text-xs text-muted-foreground">
        Required fields are marked with an asterisk (*).
      </p>

      {state.status === "error" ? (
        <div
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
          className="rounded-lg border border-destructive-border bg-destructive p-3 font-medium text-destructive-foreground outline-none"
        >
          {state.message}
        </div>
      ) : null}

      <div>
        <label
          htmlFor="forgot-password-email"
          className="block font-medium text-foreground"
        >
          Email{" "}
          <span aria-hidden="true" className="text-muted-foreground">
            *
          </span>
        </label>
        <input
          id="forgot-password-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          defaultValue={state.values.email}
          className={`${INPUT_CLASS_NAME} ${
            error ? "border-destructive-foreground/50" : "border-input"
          }`}
        />
        {error ? (
          <p
            id="forgot-password-email-error"
            className="mt-1 text-sm font-medium text-destructive-foreground"
          >
            {error}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Sending link…" : "Send reset link"}
      </Button>

      <p className="text-muted-foreground">
        Remembered your password?{" "}
        <AuthLink href={AUTH_SIGN_IN_PATH}>Sign in</AuthLink>.
      </p>
    </form>
  );
}
