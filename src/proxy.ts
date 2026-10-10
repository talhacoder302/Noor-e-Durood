import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

// Files that really exist (public/ and metadata routes). Any other path with
// a file extension would otherwise be matched as [locale] = "x.php" and render
// the layout just to 404, so bots probing /wp-login.php etc. get a cheap 404.
const PUBLIC_FILE =
  /^\/(?:favicon\.ico|icon\.svg|sw\.js|manifest\.webmanifest|robots\.txt|sitemap\.xml|icons\/[\w.-]+\.(?:png|svg))$/;

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (/\.[^/]+$/.test(pathname)) {
    return PUBLIC_FILE.test(pathname) ? NextResponse.next() : new NextResponse(null, { status: 404 });
  }
  return intl(request);
}

export const config = {
  // Everything except API routes and Next internals.
  matcher: "/((?!api|_next|_vercel).*)",
};
