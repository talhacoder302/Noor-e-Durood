import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals and any file with an extension.
  // Note the double backslash: "\." in a JS string is just "." and would
  // skip every path longer than one character.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
