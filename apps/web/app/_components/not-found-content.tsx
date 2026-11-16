import Link from "next/link";

import { Button } from "@repo/ui/components/ui/button";

type NotFoundContentProps = {
  homeHref: string;
  homeLabel: string;
};

/** Body of the 404 pages rendered inside each route group's layout. */
export function NotFoundContent({ homeHref, homeLabel }: NotFoundContentProps) {
  return (
    <section
      aria-labelledby="not-found-title"
      className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 shadow-sm sm:p-10"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        404
      </p>
      <h1
        id="not-found-title"
        className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
      >
        Page not found
      </h1>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">
        The page you are looking for does not exist or may have moved. Use the
        link below to return to a known page.
      </p>
      <div className="mt-8">
        <Button asChild>
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
      </div>
    </section>
  );
}
