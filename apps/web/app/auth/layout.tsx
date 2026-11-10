import Link from "next/link";
import type { ReactNode } from "react";

import { skipLinkClassName } from "../_components/shared-styles";

type AuthLayoutProps = {
  children: ReactNode;
};

/**
 * Public authentication shell: light-only, keyboard friendly and centred at
 * every breakpoint. Placeholders from slices 004 to 008 render inside it.
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      data-layout="auth"
      className="flex min-h-dvh flex-col bg-background text-foreground"
    >
      <a href="#main" className={skipLinkClassName}>
        Skip to content
      </a>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center px-6 py-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-md px-2 text-base font-semibold tracking-tight text-foreground"
          >
            Experts
          </Link>
        </div>
      </header>
      <main
        id="main"
        className="flex flex-1 items-center justify-center px-6 py-12"
      >
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center px-6 py-3 text-sm text-muted-foreground">
          <p>Experts · Authentication</p>
        </div>
      </footer>
    </div>
  );
}
