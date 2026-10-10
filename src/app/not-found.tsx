import Link from "next/link";

// Fallback for requests that never reach a locale (the proxy normally
// rewrites everything to one). Needs its own <html> since there is no root
// layout above [locale].
export default function RootNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "4rem 1rem" }}>
        <h1>404</h1>
        <p>
          <Link href="/">Noor-e-Durood</Link>
        </p>
      </body>
    </html>
  );
}
