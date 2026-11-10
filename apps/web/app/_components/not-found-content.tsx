import Link from "next/link";

import { textLinkClassName } from "./shared-styles";

type NotFoundContentProps = {
  homeHref: string;
  homeLabel: string;
};

/** Body of the 404 pages rendered inside each route group's layout. */
export function NotFoundContent({ homeHref, homeLabel }: NotFoundContentProps) {
  return (
    <section aria-labelledby="not-found-title" className="max-w-2xl">
      <p className="text-sm font-medium tracking-wide text-muted-foreground">
        404
      </p>
      <h1
        id="not-found-title"
        className="mt-2 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
      >
        Page not found
      </h1>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">
        The page you are looking for does not exist or has moved.
      </p>
      <p className="mt-6 text-sm">
        <Link href={homeHref} className={textLinkClassName}>
          {homeLabel}
        </Link>
      </p>
    </section>
  );
}
