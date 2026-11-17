"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useActionState, useEffect, useRef } from "react";

import {
  createInitialSignUpState,
  type SignUpFieldName,
} from "../../../lib/auth/sign-up";
import { AUTH_SIGN_IN_PATH } from "../../../lib/auth/route-rules";
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
      <StatusNotice title={state.message}>
        <p className="leading-relaxed">
          We sent a confirmation link to{" "}
          <strong className="font-semibold">{state.values.email}</strong>. Open
          it to activate your account. The link expires in 24 hours.
        </p>
        <p>
          Already confirmed?{" "}
          <AuthLink href={AUTH_SIGN_IN_PATH}>Sign in</AuthLink>.
        </p>
      </StatusNotice>
    );
  }

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
            <FieldLabel htmlFor={fieldId(field.name)}>{field.label}</FieldLabel>
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
              className={inputClassName(Boolean(error))}
            />
            {field.hint ? (
              <FieldHint id={hintId(field.name)}>{field.hint}</FieldHint>
            ) : null}
            {error ? (
              <FieldError id={errorId(field.name)}>{error}</FieldError>
            ) : null}
          </div>
        );
      })}

      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? "Creating account…" : "Create account"}
      </Button>

      <FormFooter>
        <p>
          Already have an account?{" "}
          <AuthLink href={AUTH_SIGN_IN_PATH}>Sign in</AuthLink>.
        </p>
      </FormFooter>
    </form>
  );
}
