import Link from "next/link";
import type { ReactNode } from "react";

import { signOutAction } from "./actions";
import { requireSessionUser } from "../../lib/auth/guards";
import { APP_HOME_PATH } from "../../lib/auth/route-rules";
import { BrandLink } from "../_components/brand";
import {
  navLinkClassName,
  skipLinkClassName,
} from "../_components/shared-styles";

type AppLayoutProps = {
  children: ReactNode;
};

function initials(firstName: string, lastName: string): string {
  return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
}

/**
 * Private shell. The guard runs on the server before rendering anything: an
 * absent, invalid or revoked session is redirected by `requireSessionUser`.
 * The token and session data never reach the rendered HTML.
 */
export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await requireSessionUser();

  return (
    <div
      data-layout="app"
      className="flex min-h-dvh flex-col bg-surface text-foreground"
    >
      <a href="#main" className={skipLinkClassName}>
        Skip to content
      </a>
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-2">
          <div className="flex items-center gap-4 sm:gap-8">
            <BrandLink href={APP_HOME_PATH} />
            <nav aria-label="Main">
              <ul className="flex items-center gap-1">
                <li>
                  <Link
                    href={APP_HOME_PATH}
                    aria-current="page"
                    className={`${navLinkClassName} bg-surface-strong`}
                  >
                    Home
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
            >
              {initials(user.firstName, user.lastName)}
            </span>
            <p className="hidden text-sm leading-tight sm:block">
              <span className="block font-medium">
                {user.firstName} {user.lastName}
              </span>
              <span className="block text-muted-foreground">{user.email}</span>
            </p>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex h-11 items-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors duration-150 ease-out hover:bg-surface-strong"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        {children}
      </main>
    </div>
  );
}
