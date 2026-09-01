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

  /**
   * Reads photographed match cards. Absent is a supported state: the
   * upload screen says so and manual entry carries on working, because a
   * league without an Anthropic account still has to be able to enter a
   * result.
   */
  ANTHROPIC_API_KEY: optional("ANTHROPIC_API_KEY"),
  /** Overridable so a cheaper model can be tried against real cards without a deploy. */
  SCORECARD_MODEL: process.env.SCORECARD_MODEL ?? "claude-opus-5",

  /**
   * Gates every scorecard write.
   *
   * A single shared secret, held by the handful of people who enter
   * results — which is what the league's own site does with its captains'
   * sign-in, and honest about what it is. It is not user accounts: it
   * cannot tell you who entered a card, only that whoever did had the
   * secret. `hrc_scorecards.applied_by` is a name typed by the person
   * saving, for the record rather than for security. When the members'
   * area lands (Clerk, per the architecture note) this is what it
   * replaces.
   *
   * Unset means the scorecard endpoints refuse everything, which is the
   * right default for a deployment nobody has configured.
   */
  ADMIN_TOKEN: optional("ADMIN_TOKEN"),

  /** Shared secret for /api/revalidate and /api/sync/league. */
  WEBHOOK_SECRET: optional("WEBHOOK_SECRET"),
  /** Vercel Deploy Hook, called when content changes so the static copy catches up. */
  VERCEL_DEPLOY_HOOK_URL: optional("VERCEL_DEPLOY_HOOK_URL"),

  get isProduction(): boolean {
    return this.NODE_ENV === "production";
  },
};
