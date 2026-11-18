/** Sender identity shared by the transactional email adapters. */
export type MailFrom = { email: string; name: string };

/** Formats the sender for providers that accept a `Name <email>` header. */
export function formatMailFrom(from: MailFrom): string {
  return `${from.name} <${from.email}>`;
}
