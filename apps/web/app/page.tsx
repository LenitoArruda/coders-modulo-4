import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@repo/ui/components/ui/button";

import { APP_HOME_PATH } from "../lib/auth/route-rules";
import { getSessionUser } from "../lib/auth/session";

export const metadata: Metadata = {
  title: "AI experts grounded in your company data",
  description:
    "Experts is a platform for specialized AI agents that answer questions and produce analyses from connected data sources.",
};

const experts = [
  {
    name: "CEO Expert",
    focus: "Strategy, business, finance, and prioritization.",
    deliverable:
      "Market diagnostics, strategic plans, scenario analysis, and executive summaries.",
  },
  {
    name: "CMO Expert",
    focus: "Marketing, brand, acquisition, and content.",
    deliverable:
      "Campaign plans, competitive analysis, editorial calendars, and funnel analysis.",
  },
  {
    name: "CTO Expert",
    focus: "Technology, architecture, security, and team.",
    deliverable:
      "Architecture evaluations, technical roadmaps, risk analysis, and hiring plans.",
  },
] as const;

const sources = [
  "PDF uploads",
  "Markdown notes",
  "Google Drive",
  "Notion",
] as const;

const steps = [
  {
    title: "Create your workspace",
    description:
      "Set up a space for your company with its experts, sources, and data.",
  },
  {
    title: "Connect your sources",
    description:
      "Bring in documents and tools so experts can work from real company context.",
  },
  {
    title: "Ask and get cited answers",
    description:
      "Send a request in natural language and receive analysis grounded in connected sources.",
  },
] as const;

export default async function Home() {
  const user = await getSessionUser();

  if (user !== null) {
    redirect(APP_HOME_PATH);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-sm focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <header className="border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-md text-base font-semibold tracking-tight text-foreground"
          >
            Experts
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/auth/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/auth/sign-up">Create account</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        <section className="border-b border-border/70 bg-gradient-to-b from-secondary/50 via-background to-background">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
            <div className="max-w-2xl">
              <p className="inline-flex rounded-full border border-border bg-card px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground">
                Specialized AI for business decisions
              </p>
              <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                A team of AI experts that knows your company data
              </h1>
              <p className="mt-6 max-w-prose text-lg leading-relaxed text-muted-foreground">
                Experts helps leaders get answers and analyses from specialized
                AI agents grounded in connected sources. Replace manual
                consolidation with questions in natural language and responses
                that point back to their origins.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/auth/sign-up">Create your account</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/auth/sign-in">Sign in</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Why teams use Experts
              </h2>
              <ul className="mt-5 space-y-4 text-sm leading-relaxed text-foreground">
                <li className="rounded-xl border border-border/70 bg-muted/40 p-4">
                  <span className="font-medium">Real context:</span>{" "}
                  <span className="text-muted-foreground">
                    experts respond from connected data, not generic knowledge
                    alone.
                  </span>
                </li>
                <li className="rounded-xl border border-border/70 bg-muted/40 p-4">
                  <span className="font-medium">Specialization:</span>{" "}
                  <span className="text-muted-foreground">
                    each expert follows the scope, tone, and analysis criteria
                    of a role.
                  </span>
                </li>
                <li className="rounded-xl border border-border/70 bg-muted/40 p-4">
                  <span className="font-medium">Traceability:</span>{" "}
                  <span className="text-muted-foreground">
                    answers are designed to cite the sources used.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="experts-heading"
          className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20"
        >
          <div className="max-w-2xl">
            <h2
              id="experts-heading"
              className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
            >
              Experts for the roles that drive decisions
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Start with role-focused agents that bring the perspective of key
              leadership positions to your requests.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {experts.map((expert) => (
              <article
                key={expert.name}
                className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <h3 className="text-xl font-semibold text-foreground">
                  {expert.name}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {expert.focus}
                </p>
                <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-foreground">
                  <span className="font-medium">Example deliverables: </span>
                  <span className="text-muted-foreground">
                    {expert.deliverable}
                  </span>
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="sources-heading"
          className="border-y border-border/70 bg-muted/30"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:items-start">
            <div>
              <h2
                id="sources-heading"
                className="text-balance text-3xl font-semibold tracking-tight text-foreground"
              >
                Connect the sources your team already uses
              </h2>
              <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">
                Bring knowledge from files and connected tools so analysis
                starts from evidence your company already has.
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {sources.map((source) => (
                  <li
                    key={source}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-sm"
                  >
                    {source}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground">
                How it works
              </h2>
              <ol className="mt-8 space-y-4">
                {steps.map((step, index) => (
                  <li
                    key={step.title}
                    className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
          <div className="rounded-2xl border border-border bg-secondary/40 p-8 text-center shadow-sm sm:p-12">
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground">
              Start with your Experts account
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Create an account to access the private area and continue setting
              up your workspace as new capabilities arrive.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/auth/sign-up">Create account</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/sign-in">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-foreground">Experts</p>
          <p>Specialized AI agents grounded in connected company data.</p>
        </div>
      </footer>
    </div>
  );
}
