import type { Metadata } from "next";

import { redirectSignedInUserToApp } from "../../../lib/auth/guards";
import {
  RETURN_TO_PARAM,
  sanitizeReturnTo,
} from "../../../lib/auth/route-rules";
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

  return (
    <AuthCard
      title="Sign in"
      description="Enter your email and password to open your Experts account."
    >
      <SignInForm returnTo={returnTo} />
    </AuthCard>
  );
}
