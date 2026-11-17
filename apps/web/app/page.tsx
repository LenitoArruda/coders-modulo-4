import { redirect } from "next/navigation";

import { getRootRedirectPath } from "../lib/auth/route-rules";
import { getSessionUser } from "../lib/auth/session";
import { Landing } from "./_components/landing";

/** Signed-in people go straight to /app; everyone else sees the landing. */
export default async function Home() {
  const user = await getSessionUser();

  if (user !== null) {
    redirect(getRootRedirectPath(true));
  }

  return <Landing />;
}
