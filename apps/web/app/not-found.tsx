import Link from "next/link";

import { Button } from "@repo/ui/components/ui/button";

export default function RootNotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium text-foreground focus:shadow-sm focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center px-6 py-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-md text-base font-semibold tracking-tight text-foreground"
          >
            Experts
          </Link>
        </div>
      </header>
      <main
        id="main"
        className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-16"
      >
        <section aria-labelledby="not-found-title" className="max-w-xl">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            404
          </p>
          <h1
            id="not-found-title"
            className="mt-3 text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl"
          >
            Page not found
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            The page you are looking for does not exist or may have moved. You
            can return to the Experts home page to continue.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/">Go to home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/auth/sign-in">Sign in</Link>
            </Button>
          </div>
        </section>
      </main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center px-6 py-3 text-sm text-muted-foreground">
          <p>Experts</p>
        </div>
      </footer>
    </div>
  );
}
