import "dotenv/config";

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 5000),

  DIRECTUS_URL: process.env.DIRECTUS_URL ?? "http://localhost:8055",
  /** The narrowly-scoped "HRC Club Service" token. Server-only, never sent to the browser. */
  DIRECTUS_SERVICE_TOKEN: optional("DIRECTUS_SERVICE_TOKEN"),

  /**
   * Development-only fallback, so the site can be run against a Directus
   * instance before `permissions:apply` has minted a service token. Refused
   * in production by lib/directus.ts — an admin credential must never be
   * what a public site authenticates with.
   */
  DIRECTUS_ADMIN_EMAIL: optional("DIRECTUS_ADMIN_EMAIL"),
  DIRECTUS_ADMIN_PASSWORD: optional("DIRECTUS_ADMIN_PASSWORD"),

  /** Shared secret for /api/revalidate and /api/sync/league. */
  WEBHOOK_SECRET: optional("WEBHOOK_SECRET"),
  /** Vercel Deploy Hook, called when content changes so the static copy catches up. */
  VERCEL_DEPLOY_HOOK_URL: optional("VERCEL_DEPLOY_HOOK_URL"),

  get isProduction(): boolean {
    return this.NODE_ENV === "production";
  },
};
