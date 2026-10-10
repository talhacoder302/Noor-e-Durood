import type { AbstractIntlMessages } from "next-intl";

// Namespaces used by client components. Only these are sent to the browser;
// server-only text (Meta, Hero, Footer, Offline, Notices, NotFound) stays on
// the server, and the admin strings go only to /admin pages.
export const PUBLIC_CLIENT_NAMESPACES = [
  "Header",
  "Counter",
  "Entry",
  "Add",
  "Tasbeeh",
  "Durood",
  "Share",
  "Install",
  "Friday",
  "Me",
  "Auth",
  "Profile",
] as const;

export function pickMessages(
  messages: AbstractIntlMessages,
  namespaces: readonly string[],
): AbstractIntlMessages {
  return Object.fromEntries(namespaces.filter((ns) => ns in messages).map((ns) => [ns, messages[ns]]));
}
