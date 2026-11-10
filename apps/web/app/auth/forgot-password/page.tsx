import type { Metadata } from "next";

import { AUTH_SIGN_IN_PATH } from "../../../lib/auth/route-rules";
import { AuthCard, AuthLink } from "../_components/auth-card";

export const metadata: Metadata = {
  title: "Forgot your password?",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      description="Password recovery is coming soon. This placeholder reserves the public recovery route and stays available with or without an active session."
    >
      <p>
        Remembered your password?{" "}
        <AuthLink href={AUTH_SIGN_IN_PATH}>Go to sign in</AuthLink>.
      </p>
    </AuthCard>
  );
}
