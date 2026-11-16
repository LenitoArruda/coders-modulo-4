import Link from "next/link";
import type { ReactNode } from "react";

import { skipLinkClassName } from "../_components/shared-styles";

type AuthLayoutProps = {
  children: ReactNode;
};

/**
 * Public authentication shell: light-only, keyboard friendly and consistent
 * with the landing page. Each auth screen renders its content inside this shell.
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      data-layout="auth"
      className="flex min-h-dvh flex-col bg-gradient-to-b from-secondary/40 via-background to-background text-foreground"
    >
      <a href="#main" className={skipLinkClassName}>
        Skip to content
      </a>
      <header className="border-b border-border/80 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-md text-base font-semibold tracking-tight text-foreground"
          >
            Experts
          </Link>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Secure access to your account
          </p>
        </div>
      </header>
      <main
        id="main"
        className="flex flex-1 items-center justify-center px-6 py-12 sm:py-16"
      >
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="border-t border-border/80 bg-card/60">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-6 py-3 text-sm text-muted-foreground">
          <p>Experts · Authentication</p>
          <p className="hidden sm:block">Light theme, en-US</p>
        </div>
      </footer>
    </div>
  );
}
