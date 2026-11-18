import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";

import {
  AUTH_SIGN_IN_PATH,
  AUTH_SIGN_UP_PATH,
} from "../../lib/auth/route-rules";
import { BrandLink } from "./brand";
import { skipLinkClassName, textLinkClassName } from "./shared-styles";

/**
 * Public landing page. Static, server-rendered content taken from
 * `.docs/BUSINESS.md`: it works without JavaScript and every call to action is
 * a real link. Nothing here states metrics, customers, prices or promises
 * beyond the documented MVP.
 */

const CONTAINER = "mx-auto w-full max-w-6xl px-6";

const BENEFITS = [
  {
    title: "Real context",
    text: "Experts answer from the sources you connect, not only from generic knowledge.",
  },
  {
    title: "Specialization",
    text: "Each Expert has the scope, tone and criteria of one position in the company.",
  },
  {
    title: "Traceability",
    text: "Answers are designed to cite the sources they used, so you can check them.",
  },
  {
    title: "Speed",
    text: "Ask in plain language instead of consolidating information by hand first.",
  },
] as const;

const EXPERTS = [
  {
    monogram: "CEO",
    name: "CEO Expert",
    focus: "Strategy, business, finance and prioritization.",
    outputs: [
      "Market diagnosis",
      "Strategic plan",
      "Scenario analysis",
      "Executive summary",
    ],
  },
  {
    monogram: "CMO",
    name: "CMO Expert",
    focus: "Marketing, brand, acquisition and content.",
    outputs: [
      "Campaign plan",
      "Competitor analysis",
      "Editorial calendar",
      "Funnel analysis",
    ],
  },
  {
    monogram: "CTO",
    name: "CTO Expert",
    focus: "Technology, architecture, security and team.",
    outputs: [
      "Architecture review",
      "Technical roadmap",
      "Risk analysis",
      "Hiring plan",
    ],
  },
] as const;

const SOURCES = [
  { name: "PDF uploads", detail: "Documents and reports" },
  { name: "Markdown", detail: "Notes and technical documentation" },
  { name: "Google Drive", detail: "Files and folders" },
  { name: "Notion", detail: "Pages and databases" },
] as const;

const STEPS = [
  {
    title: "Connect your sources",
    text: "Add the documents and tools where your company's knowledge already lives.",
  },
  {
    title: "Let it sync",
    text: "The platform reads, normalizes and indexes the content you connected.",
  },
  {
    title: "Pick an Expert",
    text: "Start with the CEO, CMO or CTO Expert, each limited to the sources you allow.",
  },
  {
    title: "Ask and check",
    text: "Ask in plain language and get an answer with references to its sources.",
  },
] as const;

const ANSWER_TRACE = [
  {
    title: "Your sources",
    text: "Documents, notes and pages you connect.",
  },
  {
    title: "A specialized Expert",
    text: "Reads only the sources it is allowed to use.",
  },
  {
    title: "An answer with citations",
    text: "Each point links back to where it came from.",
  },
] as const;

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div
        className={`${CONTAINER} flex min-h-16 items-center justify-between gap-4`}
      >
        <BrandLink href="/" />
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {[
              ["#experts", "Experts"],
              ["#sources", "Sources"],
              ["#how-it-works", "How it works"],
            ].map(([href, label]) => (
              <li key={href}>
                <a
                  href={href}
                  className="inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-foreground transition-colors duration-150 ease-out hover:bg-surface-strong"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href={AUTH_SIGN_IN_PATH}>Sign in</Link>
          </Button>
          <Button asChild>
            <Link href={AUTH_SIGN_UP_PATH}>Create account</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function AnswerTrace() {
  return (
    <figure className="rounded-xl border border-border bg-surface p-6 sm:p-8">
      <figcaption className="text-sm font-medium text-muted-foreground">
        How an answer is built
      </figcaption>
      <ol className="mt-6">
        {ANSWER_TRACE.map((step, index) => (
          <li key={step.title} className="relative flex gap-4 pb-8 last:pb-0">
            {index < ANSWER_TRACE.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-px bg-border-strong"
              />
            ) : null}
            <span
              aria-hidden="true"
              className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            >
              {index + 1}
            </span>
            <div>
              <p className="font-semibold text-foreground">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}

function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className={`${CONTAINER} grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16 lg:py-28`}
    >
      <div>
        <h1
          id="hero-title"
          className="text-balance text-4xl font-semibold leading-[1.05] tracking-tighter text-foreground sm:text-5xl lg:text-6xl"
        >
          A team of AI experts that knows your company&apos;s data
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
          Experts are AI agents specialized in one position, like CEO, CMO or
          CTO. They answer from the sources you connect and show where each
          answer came from.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href={AUTH_SIGN_UP_PATH}>Create your account</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={AUTH_SIGN_IN_PATH}>Sign in</Link>
          </Button>
        </div>
      </div>
      <AnswerTrace />
    </section>
  );
}

function Benefits() {
  return (
    <section
      aria-labelledby="benefits-title"
      className="border-t border-border"
    >
      <div
        className={`${CONTAINER} grid gap-10 py-16 sm:py-20 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16`}
      >
        <h2
          id="benefits-title"
          className="max-w-sm text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
        >
          Generic AI doesn&apos;t know your company. Experts do.
        </h2>
        <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.title}
              className="border-t border-border-strong pt-4"
            >
              <dt className="text-lg font-semibold">{benefit.title}</dt>
              <dd className="mt-2 leading-relaxed text-muted-foreground">
                {benefit.text}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Experts() {
  return (
    <section
      id="experts"
      aria-labelledby="experts-title"
      className="border-t border-border bg-surface"
    >
      <div className={`${CONTAINER} py-16 sm:py-20`}>
        <h2
          id="experts-title"
          className="max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
        >
          Start with three Experts
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Each Expert is built from a template, instructions and the sources it
          is allowed to read.
        </p>
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {EXPERTS.map((expert) => (
            <li
              key={expert.monogram}
              className="rounded-xl border border-border bg-card p-6"
            >
              <span
                aria-hidden="true"
                className="flex h-12 w-16 items-center justify-center rounded-md bg-secondary text-base font-semibold text-secondary-foreground"
              >
                {expert.monogram}
              </span>
              <h3 className="mt-5 text-xl font-semibold">{expert.name}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {expert.focus}
              </p>
              <p className="mt-6 text-sm font-medium">Can produce</p>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {expert.outputs.map((output) => (
                  <li key={output} className="flex gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                    />
                    {output}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Sources() {
  return (
    <section
      id="sources"
      aria-labelledby="sources-title"
      className="border-t border-border"
    >
      <div
        className={`${CONTAINER} grid gap-10 py-16 sm:py-20 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16`}
      >
        <div>
          <h2
            id="sources-title"
            className="max-w-sm text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
          >
            Connect the sources your team already uses
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
            The first connectors cover the places where most company knowledge
            lives.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {SOURCES.map((source) => (
            <li
              key={source.name}
              className="rounded-xl border border-border-strong p-5"
            >
              <p className="text-lg font-semibold">{source.name}</p>
              <p className="mt-1 text-muted-foreground">{source.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="border-t border-border bg-surface"
    >
      <div className={`${CONTAINER} py-16 sm:py-20`}>
        <h2
          id="how-title"
          className="max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
        >
          From your data to a first answer in four steps
        </h2>
        <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-t-2 border-primary pt-4">
              <p className="text-sm font-semibold text-primary">
                Step {index + 1}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="border-t border-border">
      <div
        className={`${CONTAINER} flex flex-col items-start gap-8 py-16 sm:py-20 md:flex-row md:items-center md:justify-between`}
      >
        <div className="max-w-xl">
          <h2
            id="cta-title"
            className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
          >
            Put a team of Experts to work on your data
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Create an account to get started. Already have one?{" "}
            <Link href={AUTH_SIGN_IN_PATH} className={textLinkClassName}>
              Sign in
            </Link>
            .
          </p>
        </div>
        <Button asChild size="lg">
          <Link href={AUTH_SIGN_UP_PATH}>Create your account</Link>
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div
        className={`${CONTAINER} flex min-h-20 flex-wrap items-center justify-between gap-4 py-4`}
      >
        <BrandLink href="/" />
        <p className="text-sm text-muted-foreground">
          AI Experts for your company&apos;s data.
        </p>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div
      data-layout="landing"
      className="flex min-h-dvh flex-col bg-background text-foreground"
    >
      <a href="#main" className={skipLinkClassName}>
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1">
        <Hero />
        <Benefits />
        <Experts />
        <Sources />
        <HowItWorks />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
