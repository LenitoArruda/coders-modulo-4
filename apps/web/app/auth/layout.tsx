import type { ReactNode } from "react";

import { BrandLink } from "../_components/brand";
import { skipLinkClassName } from "../_components/shared-styles";

type AuthLayoutProps = {
  children: ReactNode;
};

const ROSTER = [
  { monogram: "CEO", name: "CEO Expert", focus: "Strategy, business, finance" },
  { monogram: "CMO", name: "CMO Expert", focus: "Marketing, brand, growth" },
  { monogram: "CTO", name: "CTO Expert", focus: "Technology, security, team" },
] as const;

/**
 * Public authentication shell. On large screens a brand panel carries the
 * product context next to the form; on small screens it collapses to the
 * brand bar so the form comes first. Light-only and keyboard friendly.
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      data-layout="auth"
      className="flex min-h-dvh flex-col bg-background text-foreground lg:flex-row"
    >
      <a href="#main" className={skipLinkClassName}>
        Skip to content
      </a>
      <aside className="border-b border-border bg-surface lg:min-h-dvh lg:w-[42%] lg:max-w-xl lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col px-6 py-2 lg:px-12 lg:py-10">
          <BrandLink href="/" />
          <div className="mt-auto hidden pb-6 lg:block">
            <p className="text-balance text-3xl font-semibold leading-tight tracking-tight">
              A team of AI experts that knows your company&apos;s data.
            </p>
            <ul className="mt-8 space-y-3">
              {ROSTER.map((expert) => (
                <li
                  key={expert.monogram}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md bg-secondary text-sm font-semibold text-secondary-foreground"
                  >
                    {expert.monogram}
                  </span>
                  <span className="text-sm">
                    <span className="block font-medium">{expert.name}</span>
                    <span className="block text-muted-foreground">
                      {expert.focus}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
      <main
        id="main"
        className="flex flex-1 items-start justify-center px-6 py-10 sm:py-14 lg:items-center lg:px-12"
      >
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
