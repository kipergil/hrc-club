import { authentication, createDirectus, customEndpoint, rest, type RestClient } from "@directus/sdk";
import { env } from "./env.js";

/**
 * Loosely-typed client used only by the bootstrap scripts in this package,
 * which operate on Directus's own system collections (directus_collections,
 * directus_fields, directus_relations, directus_policies, ...). Application
 * code uses its own typed client and the scoped service token instead.
 */
export type SchemaClient = ReturnType<typeof createDirectus<Record<string, unknown[]>>> &
  RestClient<Record<string, unknown[]>>;

let cachedSchemaClient: SchemaClient | null = null;

/** Admin-authenticated client for schema/permissions bootstrapping. */
export async function getSchemaClient(): Promise<SchemaClient> {
  if (cachedSchemaClient) return cachedSchemaClient;

  const client = createDirectus<Record<string, unknown[]>>(env.DIRECTUS_URL)
    .with(authentication("json"))
    .with(rest());

  await client.login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);

  // These scripts do read-then-write idempotency checks across separate
  // process runs — start from a clean cache rather than trusting
  // invalidation across runs, since a Redis-backed query cache can
  // otherwise serve a stale "not found" for a row a previous run created.
  await client.request(customEndpoint({ path: "/utils/cache/clear", method: "POST" }));

  cachedSchemaClient = client as SchemaClient;
  return cachedSchemaClient;
}
