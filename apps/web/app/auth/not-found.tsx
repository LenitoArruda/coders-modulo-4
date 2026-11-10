import { AUTH_SIGN_UP_PATH } from "../../lib/auth/route-rules";
import { AuthCard, AuthLink } from "./_components/auth-card";

export default function AuthNotFound() {
  return (
    <AuthCard
      title="Page not found"
      description="The authentication page you are looking for does not exist or has moved."
    >
      <p>
        <AuthLink href={AUTH_SIGN_UP_PATH}>Go to sign up</AuthLink>
      </p>
    </AuthCard>
  );
}
