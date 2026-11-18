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
import {
  FieldError,
  FieldLabel,
  FormAlert,
  FormFooter,
  RequiredNote,
} from "../../_components/form-parts";
import { inputClassName } from "../../_components/shared-styles";

import { signInAction } from "./actions";

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
      className="space-y-6"
    >
      <input type="hidden" name={RETURN_TO_PARAM} value={returnTo} />

      <RequiredNote />

      {state.status === "error" ? (
        <FormAlert ref={summaryRef}>
          <p>{state.message}</p>
          {needsConfirmation ? (
            <p className="mt-1">
              Open the confirmation link we emailed you, then sign in again.
            </p>
          ) : null}
        </FormAlert>
      ) : null}

      <div>
        <FieldLabel htmlFor="sign-in-email">Email</FieldLabel>
        <input
          id="sign-in-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "sign-in-email-error" : undefined}
          defaultValue={state.values.email}
          className={inputClassName(Boolean(emailError))}
        />
        {emailError ? (
          <FieldError id="sign-in-email-error">{emailError}</FieldError>
        ) : null}
      </div>

      <div>
        <FieldLabel htmlFor="sign-in-password">Password</FieldLabel>
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
          className={inputClassName(Boolean(passwordError))}
        />
        {passwordError ? (
          <FieldError id="sign-in-password-error">{passwordError}</FieldError>
        ) : null}
      </div>

      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>

      <FormFooter>
        <p>
          <AuthLink href={AUTH_FORGOT_PASSWORD_PATH}>Forgot password?</AuthLink>
        </p>
        <p>
          New to Experts?{" "}
          <AuthLink href={AUTH_SIGN_UP_PATH}>Create an account</AuthLink>.
        </p>
      </FormFooter>
    </form>
  );
}
