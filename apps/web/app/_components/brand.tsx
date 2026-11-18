import Link from "next/link";

type BrandMarkProps = {
  className?: string;
};

/** Three bars of different lengths: a team of Experts reading the same data. */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <rect
        x="8"
        y="8"
        width="16"
        height="3.5"
        rx="1.75"
        className="fill-primary-foreground"
      />
      <rect
        x="8"
        y="14.25"
        width="11"
        height="3.5"
        rx="1.75"
        className="fill-accent"
      />
      <rect
        x="8"
        y="20.5"
        width="14"
        height="3.5"
        rx="1.75"
        className="fill-primary-foreground"
      />
    </svg>
  );
}

type BrandLinkProps = {
  href: string;
};

export function BrandLink({ href }: BrandLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center gap-2.5 rounded-md pr-2 text-base font-semibold tracking-tight text-foreground"
    >
      <BrandMark />
      <span>Experts</span>
    </Link>
  );
}
