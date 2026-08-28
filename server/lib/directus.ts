import {
  authentication,
  createDirectus,
  rest,
  staticToken,
  type RestClient,
} from "@directus/sdk";
import { env } from "./env.js";

/**
 * The Directus SDK types every query against a generated schema. There is
 * no generated schema here — the collections are defined in `directus/`,
 * not in the app — so the item type is left open and the read models in
 * `shared/types.ts` are what the rest of the codebase is typed against.
 * `server/storage.ts` is the single boundary where one becomes the other.
 */
type Schema = Record<string, any[]>;

export type DirectusClient = RestClient<Schema>;

let cached: Promise<DirectusClient> | null = null;

/**
 * The site's one connection to Directus, authenticated with the
 * `HRC Club Service` static token — no admin access, no panel login, and
 * no reach beyond `hrc_*` and `directus_files`. That scoping is what makes
 * it safe for this token to sit behind every public route: even a route
 * handler that asks for `*` on `hrc_members` cannot be given the contact
 * columns, because the policy does not include them.
 */
async function connect(): Promise<DirectusClient> {
  if (env.DIRECTUS_SERVICE_TOKEN) {
    return createDirectus<Schema>(env.DIRECTUS_URL)
      .with(staticToken(env.DIRECTUS_SERVICE_TOKEN))
      .with(rest()) as DirectusClient;
  }

  // Development convenience only — see env.ts. Refused in production
  // rather than merely discouraged, because a fallback that works in
  // production is a fallback that ends up in production.
  if (env.isProduction) {
    throw new Error(
      "DIRECTUS_SERVICE_TOKEN is not set. Run `npm run directus:permissions:apply` and set it.",
    );
  }

  if (!env.DIRECTUS_ADMIN_EMAIL || !env.DIRECTUS_ADMIN_PASSWORD) {
    throw new Error(
      "No Directus credentials. Set DIRECTUS_SERVICE_TOKEN, or DIRECTUS_ADMIN_EMAIL and " +
        "DIRECTUS_ADMIN_PASSWORD for local development.",
    );
  }

  const client = createDirectus<Schema>(env.DIRECTUS_URL)
    .with(authentication("json"))
    .with(rest());
  await client.login(env.DIRECTUS_ADMIN_EMAIL, env.DIRECTUS_ADMIN_PASSWORD);
  return client as unknown as DirectusClient;
}

export function directus(): Promise<DirectusClient> {
  if (!cached) {
    cached = connect().catch((error) => {
      // Don't cache a failed connection — a Directus restart should not
      // require an app restart.
      cached = null;
      throw error;
    });
  }
  return cached;
}
