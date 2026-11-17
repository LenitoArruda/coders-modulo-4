"use client";

import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";
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
import {
  FieldError,
  FieldHint,
  FieldLabel,
  FormAlert,
  FormFooter,
  RequiredNote,
  StatusNotice,
} from "../../_components/form-parts";
import { inputClassName } from "../../_components/shared-styles";

import { resetPasswordAction } from "./actions";

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
      <StatusNotice title="Your password has been updated.">
        <p className="leading-relaxed">
          Taking you to sign in.{" "}
          <AuthLink href={SUCCESS_REDIRECT_PATH}>Go to sign in</AuthLink>.
        </p>
      </StatusNotice>
    );
  }

  if (state.invalidToken) {
    return (
      <div className="space-y-6">
        <FormAlert ref={summaryRef}>{state.message}</FormAlert>
        <Button asChild size="lg" className="w-full">
          <Link href={AUTH_FORGOT_PASSWORD_PATH}>Request a new reset link</Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          Or <AuthLink href={AUTH_SIGN_IN_PATH}>go back to sign in</AuthLink>.
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      noValidate
      aria-busy={isPending}
      className="space-y-6"
    >
      <input type="hidden" name={RESET_TOKEN_FIELD} value={token} />

      <RequiredNote />

      {state.status === "error" ? (
        <FormAlert ref={summaryRef}>{state.message}</FormAlert>
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
            <FieldLabel htmlFor={field.id}>{field.label}</FieldLabel>
            <input
              id={field.id}
              name={field.name}
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={inputClassName(Boolean(error))}
            />
            {field.hint ? (
              <FieldHint id={hintId}>{field.hint}</FieldHint>
            ) : null}
            {error ? <FieldError id={errorId}>{error}</FieldError> : null}
          </div>
        );
      })}

      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? "Updating password…" : "Update password"}
      </Button>

      <FormFooter>
        <p>
          <AuthLink href={AUTH_SIGN_IN_PATH}>Back to sign in</AuthLink>
        </p>
      </FormFooter>
    </form>
  );
}
