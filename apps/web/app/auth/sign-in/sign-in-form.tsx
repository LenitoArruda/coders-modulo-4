"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useActionState, useEffect, useRef } from "react";

import {
  AUTH_FORGOT_PASSWORD_PATH,
  AUTH_SIGN_UP_PATH,
  RETURN_TO_PARAM,
} from "../../../lib/auth/route-rules";
import {
  SIGN_IN_EMAIL_NOT_CONFIRMED_MESSAGE,
  createInitialSignInState,
} from "../../../lib/auth/sign-in";
import { AuthLink } from "../_components/auth-card";

import { signInAction } from "./actions";

const INPUT_CLASS_NAME =
  "mt-2 h-11 w-full rounded-md border bg-background px-3 text-base text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

type SignInFormProps = {
  /** Already validated by the page; the action validates it again. */
  returnTo: string;
};

export function SignInForm({ returnTo }: SignInFormProps) {
  const [state, formAction, isPending] = useActionState(
    signInAction,
    createInitialSignInState(),
  );
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "error") {
      summaryRef.current?.focus();
    }
  }, [state]);

  const emailError = state.fieldErrors.email;
  const passwordError = state.fieldErrors.password;
  const needsConfirmation =
    state.status === "error" &&
    state.message === SIGN_IN_EMAIL_NOT_CONFIRMED_MESSAGE;

  return (
    <form
      action={formAction}
      noValidate
      aria-busy={isPending}
      className="space-y-5 text-sm text-foreground"
    >
      <input type="hidden" name={RETURN_TO_PARAM} value={returnTo} />

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
          <p>{state.message}</p>
          {needsConfirmation ? (
            <p className="mt-1">
              Open the confirmation link we emailed you, then sign in again.
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <label
          htmlFor="sign-in-email"
          className="block font-medium text-foreground"
        >
          Email{" "}
          <span aria-hidden="true" className="text-muted-foreground">
            *
          </span>
        </label>
        <input
          id="sign-in-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "sign-in-email-error" : undefined}
          defaultValue={state.values.email}
          className={`${INPUT_CLASS_NAME} ${
            emailError ? "border-red-600" : "border-input"
          }`}
        />
        {emailError ? (
          <p
            id="sign-in-email-error"
            className="mt-1 text-sm font-medium text-red-700"
          >
            {emailError}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="sign-in-password"
          className="block font-medium text-foreground"
        >
          Password{" "}
          <span aria-hidden="true" className="text-muted-foreground">
            *
          </span>
        </label>
        <input
          id="sign-in-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={
            passwordError ? "sign-in-password-error" : undefined
          }
          className={`${INPUT_CLASS_NAME} ${
            passwordError ? "border-red-600" : "border-input"
          }`}
        />
        {passwordError ? (
          <p
            id="sign-in-password-error"
            className="mt-1 text-sm font-medium text-red-700"
          >
            {passwordError}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>

      <div className="space-y-2 text-muted-foreground">
        <p>
          <AuthLink href={AUTH_FORGOT_PASSWORD_PATH}>Forgot password?</AuthLink>
        </p>
        <p>
          New to Experts?{" "}
          <AuthLink href={AUTH_SIGN_UP_PATH}>Create an account</AuthLink>.
        </p>
      </div>
    </form>
  );
}
