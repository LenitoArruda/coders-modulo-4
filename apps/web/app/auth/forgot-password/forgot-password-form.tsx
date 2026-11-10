"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useActionState, useEffect, useRef } from "react";

import { createInitialForgotPasswordState } from "../../../lib/auth/forgot-password";
import { AUTH_SIGN_IN_PATH } from "../../../lib/auth/route-rules";
import { AuthLink } from "../_components/auth-card";

import { forgotPasswordAction } from "./actions";

const INPUT_CLASS_NAME =
  "mt-2 h-11 w-full rounded-md border bg-background px-3 text-base text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

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
        className="rounded-md border border-border bg-secondary p-4 text-secondary-foreground"
      >
        <p className="text-base font-medium">{state.message}</p>
        <p className="mt-2 leading-relaxed">
          If the account exists, open the link in the email to choose a new
          password. The link expires in 1 hour.
        </p>
        <p className="mt-4">
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
          className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800"
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
            error ? "border-red-600" : "border-input"
          }`}
        />
        {error ? (
          <p
            id="forgot-password-email-error"
            className="mt-1 text-sm font-medium text-red-700"
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
