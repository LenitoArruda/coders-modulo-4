import type { Metadata } from "next";

import { AUTH_SIGN_IN_PATH } from "../../../lib/auth/route-rules";
import { AuthCard, AuthLink } from "../_components/auth-card";

export const metadata: Metadata = {
  title: "Reset your password",
};

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Password reset is coming soon. This placeholder reserves the public reset route and stays available with or without an active session."
    >
      <p>
        Back to <AuthLink href={AUTH_SIGN_IN_PATH}>sign in</AuthLink>.
      </p>
    </AuthCard>
  );
}
