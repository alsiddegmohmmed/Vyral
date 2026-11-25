// The build this bundle came from. Baked in at build time on both the server and
// the client, so a phone can tell when a newer deploy is live (fixes.md #3).
// Set NEXT_PUBLIC_APP_VERSION in CI, or let Vercel's exposed commit SHA fill it.
export const APP_VERSION: string =
  (process.env.NEXT_PUBLIC_APP_VERSION || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 40);
