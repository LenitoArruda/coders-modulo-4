import { redirect } from "next/navigation";

import { getRootRedirectPath } from "../lib/auth/route-rules";
import { getSessionUser } from "../lib/auth/session";

export default async function Home() {
  const user = await getSessionUser();

  redirect(getRootRedirectPath(user !== null));
}
