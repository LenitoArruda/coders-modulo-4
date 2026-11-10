import type { Metadata } from "next";

import { redirectSignedInUserToApp } from "../../../lib/auth/guards";
import { AUTH_SIGN_IN_PATH } from "../../../lib/auth/route-rules";
import { AuthCard, AuthLink } from "../_components/auth-card";

export const metadata: Metadata = {
  title: "Confirm your email",
};

export default async function ConfirmPage() {
  await redirectSignedInUserToApp();

  return (
    <AuthCard
      title="Confirm your email"
      description="Email confirmation is coming soon. This placeholder reserves the public confirmation route for the next slice."
    >
      <p>
        Already confirmed? <AuthLink href={AUTH_SIGN_IN_PATH}>Sign in</AuthLink>
        .
      </p>
    </AuthCard>
  );
}
