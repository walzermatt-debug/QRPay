import { headers } from "next/headers";

/** Resolves the site's base URL from the incoming request, so links work locally and on Vercel. */
export async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (host) {
    const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}
