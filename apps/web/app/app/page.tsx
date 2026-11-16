import type { Metadata } from "next";

import { requireSessionUser } from "../../lib/auth/guards";

export const metadata: Metadata = {
  title: "Home",
};

const nextSteps = [
  {
    title: "Account ready",
    description:
      "Your email is confirmed and your session is active in the private area.",
  },
  {
    title: "Workspace setup ahead",
    description:
      "Upcoming slices will add workspace creation, connected sources, and expert workflows.",
  },
  {
    title: "Ask with context",
    description:
      "As capabilities arrive, you will be able to request analyses grounded in your connected data.",
  },
] as const;

export default async function AppHomePage() {
  const user = await requireSessionUser();

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="app-home-title"
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      >
        <div className="border-b border-border/70 bg-gradient-to-r from-secondary/60 via-card to-card px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Private area
          </p>
          <h1
            id="app-home-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Welcome, {user.firstName}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            This is the beginning of your Experts account. You are signed in and
            ready for the next product capabilities as they become available.
          </p>
        </div>
        <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 sm:px-8">
          <div className="rounded-xl border border-border bg-muted/30 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Signed in as
            </h2>
            <p className="mt-2 text-base font-medium text-foreground">
              {user.firstName} {user.lastName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              What you can do now
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Access is secured by your active session. Use the navigation to
              return home, and sign out when you are finished.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="next-steps-title" className="space-y-4">
        <div className="max-w-2xl">
          <h2
            id="next-steps-title"
            className="text-2xl font-semibold tracking-tight text-foreground"
          >
            What happens next
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The product foundation is in place. Here is what this private area
            is preparing for.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {nextSteps.map((step, index) => (
            <article
              key={step.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Step {index + 1}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
