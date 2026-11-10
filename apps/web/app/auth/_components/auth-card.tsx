import Link from "next/link";
import type { ReactNode } from "react";

import { textLinkClassName } from "../../_components/shared-styles";

type AuthCardProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

/**
 * Card shared by the public auth placeholders. It only renders content; the
 * auth layout owns the page chrome and the accessibility landmarks.
 */
export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <section
      aria-labelledby="auth-title"
      className="w-full rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <h1
        id="auth-title"
        className="text-balance text-3xl font-semibold tracking-tight text-foreground"
      >
        {title}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        {description}
      </p>
      {children ? (
        <div className="mt-6 space-y-2 text-sm text-muted-foreground">
          {children}
        </div>
      ) : null}
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
