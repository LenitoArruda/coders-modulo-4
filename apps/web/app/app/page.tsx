import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home",
};

export default function AppHomePage() {
  return (
    <section aria-labelledby="app-home-title" className="max-w-2xl">
      <p className="text-sm font-medium tracking-wide text-muted-foreground">
        Private area
      </p>
      <h1
        id="app-home-title"
        className="mt-2 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
      >
        Welcome to Experts
      </h1>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">
        Your dashboard is coming soon. This placeholder confirms that the
        private area, its shell and the session guard are in place.
      </p>
      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">
          What happens next
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Sign-up, email confirmation, sign-in and password recovery will
          replace these placeholders in the next slices.
        </p>
      </div>
    </section>
  );
}
