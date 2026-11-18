import Link from "next/link";
import type { ReactNode } from "react";

import { textLinkClassName } from "../../_components/shared-styles";

type AuthCardProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

/**
 * Heading block plus content shared by every auth page. The auth layout owns
 * the page chrome and the landmarks; this only owns the page heading.
 */
export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <section aria-labelledby="auth-title" className="w-full">
      <h1
        id="auth-title"
        className="text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl"
      >
        {title}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        {description}
      </p>
      {children ? <div className="mt-8 space-y-6">{children}</div> : null}
    </section>
  );
}

type AuthLinkProps = {
  href: string;
  children: ReactNode;
};

export function AuthLink({ href, children }: AuthLinkProps) {
  return (
    <Link href={href} className={textLinkClassName}>
      {children}
    </Link>
  );
}
