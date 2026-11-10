import type { Metadata } from "next";

import { RESET_TOKEN_FIELD } from "../../../lib/auth/reset-password";
import { AuthCard } from "../_components/auth-card";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
};

type ResetPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readToken(
  params: Record<string, string | string[] | undefined>,
): string {
  const value = params[RESET_TOKEN_FIELD];
  const token = Array.isArray(value) ? value[0] : value;

  return typeof token === "string" ? token.trim() : "";
}

/**
 * Public route, reachable with or without a session so recovery works from any
 * device. The token is read here, on the server, and handed to the form; the
 * form removes it from the address bar right after hydration. `next.config.js`
 * answers this route with `Referrer-Policy: no-referrer`, and the page loads
 * no external resources, so the token cannot leak through `Referer`.
 */
export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const token = readToken(await searchParams);

  return (
    <AuthCard
      title="Reset your password"
      description="Choose a new password for your Experts account. Every active session is signed out after the change."
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
