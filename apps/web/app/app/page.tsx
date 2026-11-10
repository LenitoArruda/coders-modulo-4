import type { Metadata } from "next";

import { requireSessionUser } from "../../lib/auth/guards";

export const metadata: Metadata = {
  title: "Home",
};

export default async function AppHomePage() {
  const user = await requireSessionUser();

  return (
    <section aria-labelledby="app-home-title" className="max-w-2xl">
      <p className="text-sm font-medium tracking-wide text-muted-foreground">
        Private area
      </p>
      <h1
        id="app-home-title"
        className="mt-2 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
      >
        Welcome, {user.firstName}
      </h1>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">
        Your email is confirmed and your session is active. This is the
        beginning of your Experts account.
      </p>
      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">
          What happens next
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Sign-in, password recovery and the first dashboard features arrive in
          the next slices.
        </p>
      </div>
    </section>
  );
}
