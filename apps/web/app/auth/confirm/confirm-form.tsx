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
import { ClockIcon } from "../../_components/icons";
import { FormAlert, StatusNotice } from "../../_components/form-parts";

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
      <StatusNotice title="Your email is confirmed.">
        <p className="leading-relaxed">
          Taking you to your account.{" "}
          <AuthLink href={APP_HOME_PATH}>Go to your account</AuthLink>.
        </p>
      </StatusNotice>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-busy={isPending}
      className="space-y-6"
    >
      <input type="hidden" name={CONFIRM_TOKEN_FIELD} value={token} />

      {state.status === "error" ? (
        <>
          <FormAlert ref={summaryRef}>{state.message}</FormAlert>
          <p className="text-sm text-muted-foreground">
            <AuthLink href={AUTH_SIGN_IN_PATH}>Sign in</AuthLink> if your email
            is already confirmed, or{" "}
            <AuthLink href={AUTH_SIGN_UP_PATH}>create an account</AuthLink> to
            request a new confirmation link.
          </p>
          {state.canRetry ? (
            <Button
              type="submit"
              size="lg"
              disabled={isPending}
              className="w-full"
            >
              {isPending ? "Trying again…" : "Try again"}
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <p
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 text-sm text-foreground"
          >
            <ClockIcon className="shrink-0 text-primary" />
            {isPending
              ? "Confirming your email…"
              : "Confirming your email automatically. This only takes a moment."}
          </p>
          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            className="w-full"
          >
            {isPending ? "Confirming…" : "Confirm my email"}
          </Button>
        </>
      )}
    </form>
  );
}
