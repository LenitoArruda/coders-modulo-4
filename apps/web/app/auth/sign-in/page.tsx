import type { Metadata } from "next";

import { redirectSignedInUserToApp } from "../../../lib/auth/guards";
import {
  AUTH_FORGOT_PASSWORD_PATH,
  AUTH_SIGN_UP_PATH,
} from "../../../lib/auth/route-rules";
import { AuthCard, AuthLink } from "../_components/auth-card";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function SignInPage() {
  await redirectSignedInUserToApp();

  return (
    <AuthCard
      title="Sign in"
      description="Sign-in is coming soon. This placeholder reserves the public sign-in route for the next slices."
    >
      <p>
        New to Experts?{" "}
        <AuthLink href={AUTH_SIGN_UP_PATH}>Create an account</AuthLink>.
      </p>
      <p>
        Forgot your password?{" "}
        <AuthLink href={AUTH_FORGOT_PASSWORD_PATH}>Recover access</AuthLink>.
      </p>
    </AuthCard>
  );
}
