/** Shared class names for the web app shells and forms. Colours come from tokens only. */
export const skipLinkClassName =
  "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-foreground focus:ring-2 focus:ring-ring";

export const textLinkClassName =
  "rounded-sm font-medium text-primary underline underline-offset-4 hover:no-underline";

/** Quiet navigation link with a 44px touch target. */
export const navLinkClassName =
  "inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-foreground transition-colors duration-150 ease-out hover:bg-surface-strong";

export const labelClassName = "block text-sm font-medium text-foreground";

const inputBaseClassName =
  "mt-2 h-11 w-full rounded-md border bg-background px-3 text-base text-foreground outline-none transition-colors duration-150 ease-out placeholder:text-muted-foreground hover:bg-surface focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring";

/** Text input classes; the invalid state changes border and adds an error text elsewhere. */
export function inputClassName(invalid: boolean): string {
  return `${inputBaseClassName} ${
    invalid ? "border-destructive" : "border-input"
  }`;
}
