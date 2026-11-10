import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  CONFIRM_INVALID_MESSAGE,
  CONFIRM_TOKEN_FIELD,
} from "../../../lib/auth/confirm";
import {
  APP_HOME_PATH,
  AUTH_SIGN_IN_PATH,
  AUTH_SIGN_UP_PATH,
} from "../../../lib/auth/route-rules";
import { getSessionUser } from "../../../lib/auth/session";
import { AuthCard, AuthLink } from "../_components/auth-card";

import { ConfirmForm } from "./confirm-form";

export const metadata: Metadata = {
  title: "Confirm your email",
};

type ConfirmPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readToken(
  params: Record<string, string | string[] | undefined>,
): string {
  const value = params[CONFIRM_TOKEN_FIELD];
  const token = Array.isArray(value) ? value[0] : value;

  return typeof token === "string" ? token.trim() : "";
}

/**
 * Public confirmation route. A token is always processed, even for someone
 * with an active session, because the new session revokes the previous ones.
 * Without a token there is nothing to confirm: signed-in people go to `/app`
 * and everyone else sees the actionable invalid-link state.
 */
export default async function ConfirmPage({ searchParams }: ConfirmPageProps) {
  const token = readToken(await searchParams);

  if (token.length > 0) {
    return (
      <AuthCard
        title="Confirm your email"
        description="We are confirming your email address. This only takes a moment."
      >
        <ConfirmForm token={token} />
      </AuthCard>
    );
  }

  const user = await getSessionUser();

  if (user !== null) {
    redirect(APP_HOME_PATH);
  }

  return (
    <AuthCard title="Confirm your email" description={CONFIRM_INVALID_MESSAGE}>
      <p>
        <AuthLink href={AUTH_SIGN_UP_PATH}>Create an account</AuthLink> to
        request a new confirmation link.
      </p>
      <p>
        Already confirmed? <AuthLink href={AUTH_SIGN_IN_PATH}>Sign in</AuthLink>
        .
      </p>
    </AuthCard>
  );
}
