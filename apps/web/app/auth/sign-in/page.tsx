import type { Metadata } from "next";

import { redirectSignedInUserToApp } from "../../../lib/auth/guards";
import {
  RETURN_TO_PARAM,
  sanitizeReturnTo,
} from "../../../lib/auth/route-rules";
import {
  RESET_PASSWORD_SUCCESS_MESSAGE,
  RESET_SUCCESS_PARAM,
  RESET_SUCCESS_VALUE,
} from "../../../lib/auth/reset-password";
import { AuthCard } from "../_components/auth-card";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
};

type SignInPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  await redirectSignedInUserToApp();

  const params = await searchParams;
  const raw = params[RETURN_TO_PARAM];
  const returnTo = sanitizeReturnTo(Array.isArray(raw) ? raw[0] : raw);

  const resetParam = params[RESET_SUCCESS_PARAM];
  const resetSucceeded =
    (Array.isArray(resetParam) ? resetParam[0] : resetParam) ===
    RESET_SUCCESS_VALUE;

  return (
    <AuthCard
      title="Sign in"
      description="Enter your email and password to open your Experts account."
    >
      {resetSucceeded ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-border bg-secondary p-3 text-secondary-foreground"
        >
          {RESET_PASSWORD_SUCCESS_MESSAGE}
        </div>
      ) : null}
      <SignInForm returnTo={returnTo} />
    </AuthCard>
  );
}
