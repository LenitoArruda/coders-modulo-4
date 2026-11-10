"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";

import {
  CONFIRM_TOKEN_FIELD,
  createInitialConfirmState,
} from "../../../lib/auth/confirm";
import {
  APP_HOME_PATH,
  AUTH_SIGN_IN_PATH,
  AUTH_SIGN_UP_PATH,
} from "../../../lib/auth/route-rules";
import { AuthLink } from "../_components/auth-card";

import { confirmAction } from "./actions";

type ConfirmFormProps = {
  token: string;
};

/**
 * Processes the token as soon as the page hydrates. The guard ref keeps the
 * automatic submission to one per mount (including React StrictMode), while
 * the submit button stays available for browsers without JavaScript and for
 * retryable failures.
 */
export function ConfirmForm({ token }: ConfirmFormProps) {
  const [state, formAction, isPending] = useActionState(
    confirmAction,
    createInitialConfirmState(),
  );
  const formRef = useRef<HTMLFormElement>(null);
  const hasAutoSubmitted = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (hasAutoSubmitted.current) {
      return;
    }

    hasAutoSubmitted.current = true;
    formRef.current?.requestSubmit();
  }, []);

  useEffect(() => {
    if (state.status === "success") {
      router.replace(APP_HOME_PATH);
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
        <p className="text-base font-medium">Your email is confirmed.</p>
        <p className="mt-2 leading-relaxed">
          Taking you to your account.{" "}
          <AuthLink href={APP_HOME_PATH}>Go to your account</AuthLink>.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-busy={isPending}
      className="space-y-5 text-sm text-foreground"
    >
      <input type="hidden" name={CONFIRM_TOKEN_FIELD} value={token} />

      {state.status === "error" ? (
        <>
          <div
            ref={summaryRef}
            role="alert"
            tabIndex={-1}
            className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800"
          >
            {state.message}
          </div>
          <p className="text-muted-foreground">
            <AuthLink href={AUTH_SIGN_IN_PATH}>Sign in</AuthLink> if your email
            is already confirmed, or{" "}
            <AuthLink href={AUTH_SIGN_UP_PATH}>create an account</AuthLink> to
            request a new confirmation link.
          </p>
          {state.canRetry ? (
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Trying again…" : "Try again"}
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <p role="status" aria-live="polite" className="text-muted-foreground">
            {isPending
              ? "Confirming your email…"
              : "Confirming your email automatically. This only takes a moment."}
          </p>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Confirming…" : "Confirm my email"}
          </Button>
        </>
      )}
    </form>
  );
}
