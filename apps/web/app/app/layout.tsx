import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@repo/ui/components/ui/button";

import { signOutAction } from "./actions";
import { requireSessionUser } from "../../lib/auth/guards";
import { APP_HOME_PATH } from "../../lib/auth/route-rules";
import { skipLinkClassName } from "../_components/shared-styles";

type AppLayoutProps = {
  children: ReactNode;
};

/**
 * Private shell. The guard runs on the server before rendering anything: an
 * absent, invalid or revoked session is redirected by `requireSessionUser`.
 * The token and session data never reach the rendered HTML.
 */
export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await requireSessionUser();
  const displayName = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const identity = displayName.length > 0 ? displayName : user.email;

  return (
    <div
      data-layout="app"
      className="flex min-h-dvh flex-col bg-muted/20 text-foreground"
    >
      <a href="#main" className={skipLinkClassName}>
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-4">
            <Link
              href={APP_HOME_PATH}
              className="inline-flex h-11 items-center rounded-md text-base font-semibold tracking-tight text-foreground"
            >
              Experts
            </Link>
            <nav aria-label="Main">
              <ul className="flex items-center gap-1">
                <li>
                  <Link
                    href={APP_HOME_PATH}
                    className="inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Home
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-[14rem] truncate text-sm font-medium text-foreground">
                {identity}
              </p>
              <p className="max-w-[14rem] truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main
        id="main"
        className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12"
      >
        {children}
      </main>
      <footer className="border-t border-border bg-card/80">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-6 py-3 text-sm text-muted-foreground">
          <p>Experts · Private area</p>
          <p className="hidden sm:block">Signed in workspace</p>
        </div>
      </footer>
    </div>
  );
}
