import type { Metadata } from "next";

import { AUTH_SIGN_IN_PATH } from "../../../lib/auth/route-rules";
import { AuthCard, AuthLink } from "../_components/auth-card";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot your password?",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter the email for your account and we will send a recovery link if the account exists."
    >
      <ForgotPasswordForm />
      <p>
        Remembered your password?{" "}
        <AuthLink href={AUTH_SIGN_IN_PATH}>Go to sign in</AuthLink>.
      </p>
    </AuthCard>
  );
}
