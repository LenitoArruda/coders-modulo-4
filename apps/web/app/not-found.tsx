import { AUTH_SIGN_IN_PATH } from "../lib/auth/route-rules";
import { BrandLink } from "./_components/brand";
import { NotFoundContent } from "./_components/not-found-content";
import { skipLinkClassName } from "./_components/shared-styles";

/** Root 404 for any route outside /auth and /app. */
export default function RootNotFound() {
  return (
    <div
      data-layout="root-not-found"
      className="flex min-h-dvh flex-col bg-background text-foreground"
    >
      <a href="#main" className={skipLinkClassName}>
        Skip to content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center px-6">
          <BrandLink href="/" />
        </div>
      </header>
      <main
        id="main"
        className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-16"
      >
        <NotFoundContent
          homeHref="/"
          homeLabel="Go to home"
          secondaryHref={AUTH_SIGN_IN_PATH}
          secondaryLabel="Sign in"
        />
      </main>
    </div>
  );
}
