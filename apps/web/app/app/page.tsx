import type { Metadata } from "next";

import { requireSessionUser } from "../../lib/auth/guards";
import { ClockIcon } from "../_components/icons";

export const metadata: Metadata = {
  title: "Home",
};

const NEXT_STEPS = [
  {
    title: "Connect a source",
    text: "Bring in a PDF, Markdown notes, Google Drive files or Notion pages.",
  },
  {
    title: "Choose an Expert",
    text: "Start with the CEO, CMO or CTO Expert.",
  },
  {
    title: "Ask your first question",
    text: "Get an answer that points back to the sources it used.",
  },
] as const;

export default async function AppHomePage() {
  const user = await requireSessionUser();

  return (
    <section aria-labelledby="app-home-title" className="space-y-10">
      <div className="max-w-2xl">
        <h1
          id="app-home-title"
          className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        >
          Welcome, {user.firstName}
        </h1>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">
          Your email is confirmed and your session is active. This is the
          beginning of your Experts account.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-foreground">
          What happens next
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          These steps are not available yet. They are the path this account will
          follow once the features arrive.
        </p>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {NEXT_STEPS.map((step, index) => (
            <li
              key={step.title}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ClockIcon width={16} height={16} />
                Step {index + 1} · Coming soon
              </p>
              <h3 className="mt-3 text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
