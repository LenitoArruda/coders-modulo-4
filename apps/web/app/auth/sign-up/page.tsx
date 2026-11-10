import type { Metadata } from "next";

import { redirectSignedInUserToApp } from "../../../lib/auth/guards";
import { AuthCard } from "../_components/auth-card";

import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Create your account",
};

export default async function SignUpPage() {
  await redirectSignedInUserToApp();

  return (
    <AuthCard
      title="Create your account"
      description="Enter your details to create an Experts account. We will email you a link to confirm your address."
    >
      <SignUpForm />
    </AuthCard>
  );
}
