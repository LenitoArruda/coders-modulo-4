import Link from "next/link";
import type { ReactNode } from "react";

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
  await requireSessionUser();

  return (
    <div
      data-layout="app"
      className="flex min-h-dvh flex-col bg-background text-foreground"
    >
      <a href="#main" className={skipLinkClassName}>
        Skip to content
      </a>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link
            href={APP_HOME_PATH}
            className="inline-flex h-11 items-center rounded-md px-2 text-base font-semibold tracking-tight text-foreground"
          >
            Experts
          </Link>
          <nav aria-label="Main">
            <ul className="flex items-center gap-1">
              <li>
                <Link
                  href={APP_HOME_PATH}
                  className="inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  Home
                </Link>
              </li>
            </ul>
          </nav>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        {children}
      </main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center px-6 py-3 text-sm text-muted-foreground">
          <p>Experts · Private area</p>
        </div>
      </footer>
    </div>
  );
}
