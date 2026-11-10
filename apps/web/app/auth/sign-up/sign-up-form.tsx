"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useActionState, useEffect, useRef } from "react";

import {
  createInitialSignUpState,
  type SignUpFieldName,
} from "../../../lib/auth/sign-up";
import { AUTH_SIGN_IN_PATH } from "../../../lib/auth/route-rules";
import { AuthLink } from "../_components/auth-card";

import { signUpAction } from "./actions";

type FieldDefinition = {
  name: SignUpFieldName;
  label: string;
  type: "text" | "email" | "password";
  autoComplete: string;
  hint?: string;
};

const FIELDS: readonly FieldDefinition[] = [
  {
    name: "firstName",
    label: "First name",
    type: "text",
    autoComplete: "given-name",
  },
  {
    name: "lastName",
    label: "Last name",
    type: "text",
    autoComplete: "family-name",
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    autoComplete: "email",
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    autoComplete: "new-password",
    hint: "Use at least 8 characters.",
  },
  {
    name: "passwordConfirmation",
    label: "Confirm password",
    type: "password",
    autoComplete: "new-password",
  },
];

const INPUT_CLASS_NAME =
  "mt-2 h-11 w-full rounded-md border bg-background px-3 text-base text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function fieldId(name: SignUpFieldName): string {
  return `sign-up-${name}`;
}

function hintId(name: SignUpFieldName): string {
  return `sign-up-${name}-hint`;
}

function errorId(name: SignUpFieldName): string {
  return `sign-up-${name}-error`;
}

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    createInitialSignUpState(),
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
          We sent a confirmation link to{" "}
          <strong className="font-semibold">{state.values.email}</strong>. Open
          it to activate your account. The link expires in 24 hours.
        </p>
        <p className="mt-4">
          Already confirmed?{" "}
          <AuthLink href={AUTH_SIGN_IN_PATH}>Sign in</AuthLink>.
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
        const describedBy = [
          field.hint ? hintId(field.name) : null,
          error ? errorId(field.name) : null,
        ]
          .filter((value): value is string => value !== null)
          .join(" ");

        return (
          <div key={field.name}>
            <label
              htmlFor={fieldId(field.name)}
              className="block font-medium text-foreground"
            >
              {field.label}{" "}
              <span aria-hidden="true" className="text-muted-foreground">
                *
              </span>
            </label>
            <input
              id={fieldId(field.name)}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={
                describedBy.length > 0 ? describedBy : undefined
              }
              defaultValue={state.values[field.name]}
              className={`${INPUT_CLASS_NAME} ${
                error ? "border-red-600" : "border-input"
              }`}
            />
            {field.hint ? (
              <p
                id={hintId(field.name)}
                className="mt-1 text-xs text-muted-foreground"
              >
                {field.hint}
              </p>
            ) : null}
            {error ? (
              <p
                id={errorId(field.name)}
                className="mt-1 text-sm font-medium text-red-700"
              >
                {error}
              </p>
            ) : null}
          </div>
        );
      })}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-muted-foreground">
        Already have an account?{" "}
        <AuthLink href={AUTH_SIGN_IN_PATH}>Sign in</AuthLink>.
      </p>
    </form>
  );
}
