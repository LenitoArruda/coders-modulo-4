"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  AUTH_FORGOT_PASSWORD_PATH,
  AUTH_RESET_PASSWORD_PATH,
  AUTH_SIGN_IN_PATH,
} from "../../../lib/auth/route-rules";
import {
  RESET_SUCCESS_PARAM,
  RESET_SUCCESS_VALUE,
  RESET_TOKEN_FIELD,
  createInitialResetPasswordState,
  createInvalidTokenState,
  type ResetPasswordFieldName,
} from "../../../lib/auth/reset-password";
import { AuthLink } from "../_components/auth-card";

import { resetPasswordAction } from "./actions";

const INPUT_CLASS_NAME =
  "mt-2 h-11 w-full rounded-md border bg-background px-3 text-base text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const SUCCESS_REDIRECT_PATH = `${AUTH_SIGN_IN_PATH}?${RESET_SUCCESS_PARAM}=${RESET_SUCCESS_VALUE}`;

type PasswordField = {
  name: ResetPasswordFieldName;
  id: string;
  label: string;
  hint?: string;
};

const FIELDS: readonly PasswordField[] = [
  {
    name: "password",
    id: "reset-password-password",
    label: "New password",
    hint: "Use 8 to 128 characters.",
  },
  {
    name: "passwordConfirmation",
    id: "reset-password-confirmation",
    label: "Confirm new password",
  },
];

type ResetPasswordFormProps = {
  /** Token read on the server from the URL; empty when the link had none. */
  token: string;
};

/**
 * The token reaches the browser once, as a prop. It is kept in state so the
 * submission still works after the address bar is cleaned: the URL is
 * rewritten with `history.replaceState` as soon as the page loads, so the
 * token does not stay in the address bar, in the history entry or in a shared
 * link. Passwords are never kept in state.
 */
export function ResetPasswordForm({
  token: initialToken,
}: ResetPasswordFormProps) {
  const [token] = useState(initialToken);
  const [state, formAction, isPending] = useActionState(
    resetPasswordAction,
    token.length === 0
      ? createInvalidTokenState()
      : createInitialResetPasswordState(),
  );
  const summaryRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    window.history.replaceState(
      window.history.state,
      "",
      AUTH_RESET_PASSWORD_PATH,
    );
  }, []);

  useEffect(() => {
    if (state.status === "success") {
      router.replace(SUCCESS_REDIRECT_PATH);
    }
  }, [router, state.status]);

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
        <p className="text-base font-medium">Your password has been updated.</p>
        <p className="mt-2 leading-relaxed">
          Taking you to sign in.{" "}
          <AuthLink href={SUCCESS_REDIRECT_PATH}>Go to sign in</AuthLink>.
        </p>
      </div>
    );
  }

  if (state.invalidToken) {
    return (
      <div className="space-y-4 text-sm text-foreground">
        <div
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
          className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800"
        >
          {state.message}
        </div>
        <p className="text-muted-foreground">
          <AuthLink href={AUTH_FORGOT_PASSWORD_PATH}>
            Request a new reset link
          </AuthLink>{" "}
          or <AuthLink href={AUTH_SIGN_IN_PATH}>go back to sign in</AuthLink>.
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      noValidate
      aria-busy={isPending}
      className="space-y-5 text-sm text-foreground"
    >
      <input type="hidden" name={RESET_TOKEN_FIELD} value={token} />

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

      {FIELDS.map((field) => {
        const error = state.fieldErrors[field.name];
        const errorId = `${field.id}-error`;
        const hintId = `${field.id}-hint`;
        const describedBy =
          [field.hint ? hintId : null, error ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined;

        return (
          <div key={field.name}>
            <label htmlFor={field.id} className="block font-medium">
              {field.label}{" "}
              <span aria-hidden="true" className="text-muted-foreground">
                *
              </span>
            </label>
            <input
              id={field.id}
              name={field.name}
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={`${INPUT_CLASS_NAME} ${
                error ? "border-red-600" : "border-input"
              }`}
            />
            {field.hint ? (
              <p id={hintId} className="mt-1 text-xs text-muted-foreground">
                {field.hint}
              </p>
            ) : null}
            {error ? (
              <p id={errorId} className="mt-1 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Updating password…" : "Update password"}
      </Button>

      <p className="text-muted-foreground">
        <AuthLink href={AUTH_SIGN_IN_PATH}>Back to sign in</AuthLink>
      </p>
    </form>
  );
}
