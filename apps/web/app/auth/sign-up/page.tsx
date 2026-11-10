import type { Metadata } from "next";

import { redirectSignedInUserToApp } from "../../../lib/auth/guards";
import { AUTH_SIGN_IN_PATH } from "../../../lib/auth/route-rules";
import { AuthCard, AuthLink } from "../_components/auth-card";

export const metadata: Metadata = {
  title: "Create your account",
};

export default async function SignUpPage() {
  await redirectSignedInUserToApp();

  return (
    <AuthCard
      title="Create your account"
      description="Account creation is coming soon. This placeholder reserves the public sign-up route for the next slice."
    >
      <p>
        Already have an account?{" "}
        <AuthLink href={AUTH_SIGN_IN_PATH}>Sign in</AuthLink>.
      </p>
    </AuthCard>
  );
}
