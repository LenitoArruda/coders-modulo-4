import Link from "next/link";

import { Button } from "@repo/ui/components/ui/button";

import { textLinkClassName } from "./shared-styles";

type NotFoundContentProps = {
  homeHref: string;
  homeLabel: string;
  /** Optional secondary route, shown as a quiet text link. */
  secondaryHref?: string;
  secondaryLabel?: string;
};

/** Body of the 404 pages rendered inside each route group's layout. */
export function NotFoundContent({
  homeHref,
  homeLabel,
  secondaryHref,
  secondaryLabel,
}: NotFoundContentProps) {
  return (
    <section aria-labelledby="not-found-title" className="max-w-xl">
      <p
        aria-hidden="true"
        className="text-7xl font-semibold leading-none tracking-tighter text-tint sm:text-8xl"
      >
        404
      </p>
      <h1
        id="not-found-title"
        className="mt-6 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
      >
        Page not found
      </h1>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">
        The page you are looking for does not exist or has moved. Check the
        address, or go back to a page that does.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button asChild size="lg">
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
        {secondaryHref && secondaryLabel ? (
          <Link href={secondaryHref} className={textLinkClassName}>
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
