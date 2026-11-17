"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useActionState, useEffect, useRef } from "react";

import { createInitialForgotPasswordState } from "../../../lib/auth/forgot-password";
import { AUTH_SIGN_IN_PATH } from "../../../lib/auth/route-rules";
import { AuthLink } from "../_components/auth-card";
import {
  FieldError,
  FieldLabel,
  FormAlert,
  FormFooter,
  RequiredNote,
  StatusNotice,
} from "../../_components/form-parts";
import { inputClassName } from "../../_components/shared-styles";

import { forgotPasswordAction } from "./actions";

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
      <StatusNotice title={state.message}>
        <p className="leading-relaxed">
          If the account exists, open the link in the email to choose a new
          password. The link expires in 1 hour.
        </p>
        <p>
          Remembered your password?{" "}
          <AuthLink href={AUTH_SIGN_IN_PATH}>Sign in</AuthLink>.
        </p>
      </StatusNotice>
    );
  }

  const error = state.fieldErrors.email;
  const describedBy = error ? "forgot-password-email-error" : undefined;

  return (
    <form
      action={formAction}
      noValidate
      aria-busy={isPending}
      className="space-y-6"
    >
      <RequiredNote />

      {state.status === "error" ? (
        <FormAlert ref={summaryRef}>{state.message}</FormAlert>
      ) : null}

      <div>
        <FieldLabel htmlFor="forgot-password-email">Email</FieldLabel>
        <input
          id="forgot-password-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          defaultValue={state.values.email}
          className={inputClassName(Boolean(error))}
        />
        {error ? (
          <FieldError id="forgot-password-email-error">{error}</FieldError>
        ) : null}
      </div>

      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? "Sending link…" : "Send reset link"}
      </Button>

      <FormFooter>
        <p>
          Remembered your password?{" "}
          <AuthLink href={AUTH_SIGN_IN_PATH}>Sign in</AuthLink>.
        </p>
      </FormFooter>
    </form>
  );
}
