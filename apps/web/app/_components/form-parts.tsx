import type { ReactNode, Ref } from "react";

import { AlertIcon, CheckCircleIcon } from "./icons";
import { labelClassName } from "./shared-styles";

type FormAlertProps = {
  /** Receives focus when the form reports an error. */
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
};

/** Error summary: announced with `role="alert"` and focusable by the form. */
export function FormAlert({ ref, children }: FormAlertProps) {
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="flex gap-3 rounded-lg border border-destructive-border bg-destructive-surface p-4 text-sm text-destructive"
    >
      <AlertIcon className="mt-0.5 shrink-0" />
      <div className="space-y-1 font-medium">{children}</div>
    </div>
  );
}

type StatusNoticeProps = {
  title: string;
  children?: ReactNode;
};

/** Success message: announced with `role="status"`, never colour only. */
export function StatusNotice({ title, children }: StatusNoticeProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex gap-3 rounded-lg border border-success-border bg-success-surface p-4 text-success"
    >
      <CheckCircleIcon className="mt-0.5 shrink-0" />
      <div className="space-y-2 text-sm">
        <p className="text-base font-semibold">{title}</p>
        {children}
      </div>
    </div>
  );
}

export function RequiredNote() {
  return (
    <p className="text-sm text-muted-foreground">
      Required fields are marked with an asterisk (*).
    </p>
  );
}

type FieldLabelProps = {
  htmlFor: string;
  children: ReactNode;
};

export function FieldLabel({ htmlFor, children }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className={labelClassName}>
      {children}{" "}
      <span aria-hidden="true" className="text-muted-foreground">
        *
      </span>
    </label>
  );
}

type FieldTextProps = {
  id: string;
  children: ReactNode;
};

export function FieldHint({ id, children }: FieldTextProps) {
  return (
    <p id={id} className="mt-1.5 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function FieldError({ id, children }: FieldTextProps) {
  return (
    <p
      id={id}
      className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-destructive"
    >
      <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Secondary actions under a form, kept quiet so the primary action leads. */
export function FormFooter({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2 border-t border-border pt-5 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
