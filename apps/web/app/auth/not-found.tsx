import Link from "next/link";

import { Button } from "@repo/ui/components/ui/button";

import {
  AUTH_SIGN_IN_PATH,
  AUTH_SIGN_UP_PATH,
} from "../../lib/auth/route-rules";
import { AuthCard, AuthLink } from "./_components/auth-card";

export default function AuthNotFound() {
  return (
    <AuthCard
      title="Page not found"
      description="The authentication page you are looking for does not exist or has moved."
    >
      <Button asChild size="lg" className="w-full">
        <Link href={AUTH_SIGN_UP_PATH}>Go to sign up</Link>
      </Button>
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <AuthLink href={AUTH_SIGN_IN_PATH}>Sign in</AuthLink>.
      </p>
    </AuthCard>
  );
}
