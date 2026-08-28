import { randomBytes } from "node:crypto";
import {
  createPermissions,
  createPolicy,
  createRole,
  createUser,
  customEndpoint,
  deletePermissions,
  readPermissions,
  readPolicies,
  readRoles,
  readUsers,
  updateUser,
} from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { env } from "../lib/env.js";
import { allPolicies } from "./definitions.js";
import type { PolicyDefinition } from "./types.js";

type Client = Awaited<ReturnType<typeof getSchemaClient>>;

async function findPolicyByName(client: Client, name: string): Promise<string | null> {
  const found = await client.request(
    readPolicies({ filter: { name: { _eq: name } }, fields: ["id"], limit: 1 }),
  );
  return found[0]?.id ?? null;
}

async function findRoleByName(client: Client, name: string): Promise<string | null> {
  const found = await client.request(
    readRoles({ filter: { name: { _eq: name } }, fields: ["id"], limit: 1 }),
  );
  return found[0]?.id ?? null;
}

/** `directus_access` (the role<->policy join) isn't wrapped by the SDK's typed commands. */
function accessQuery(filter: Record<string, unknown>, limit: number): string {
  return `/access?${new URLSearchParams({ filter: JSON.stringify(filter), limit: String(limit) }).toString()}`;
}

async function ensureAccess(client: Client, roleId: string, policyId: string): Promise<void> {
  const existing = await client.request(
    customEndpoint<Array<{ id: string }>>({
      path: accessQuery({ role: { _eq: roleId }, policy: { _eq: policyId } }, 1),
      method: "GET",
    }),
  );
  if (existing.length > 0) return;

  await client.request(
    customEndpoint({
      path: "/access",
      method: "POST",
      body: JSON.stringify({ role: roleId, policy: policyId }),
    }),
  );
}

/**
 * Deletes and recreates this policy's rules so `definitions.ts` is the sole
 * source of truth — a rule removed there is removed here. Scoped by policy
 * id, so it only ever touches rules belonging to the policy this project
 * created, never another project's.
 */
async function replacePermissions(
  client: Client,
  policyId: string,
  rules: PolicyDefinition["rules"],
): Promise<void> {
  const existing = await client.request(
    readPermissions({ filter: { policy: { _eq: policyId } }, fields: ["id"], limit: -1 }),
  );
  const existingIds = existing.map((p) => p.id);
  if (existingIds.length > 0) {
    await client.request(deletePermissions(existingIds));
  }

  if (rules.length === 0) return;

  await client.request(
    createPermissions(
      rules.map((rule) => ({
        policy: policyId,
        collection: rule.collection,
        action: rule.action,
        permissions: rule.filter ?? {},
        fields: rule.fields ?? ["*"],
      })),
    ),
  );
}

async function ensurePolicy(client: Client, def: PolicyDefinition): Promise<void> {
  let policyId = await findPolicyByName(client, def.name);
  if (!policyId) {
    const created = await client.request(
      createPolicy({
        name: def.name,
        icon: def.icon,
        description: def.description,
        admin_access: def.adminAccess,
        app_access: def.appAccess,
      }),
    );
    policyId = created.id;
    console.log(`  + policy ${def.name}`);
  } else {
    console.log(`  = policy ${def.name} already exists`);
  }

  if (def.role) {
    let roleId = await findRoleByName(client, def.name);
    if (!roleId) {
      const createdRole = await client.request(
        createRole({ name: def.name, icon: def.role.icon, description: def.description }),
      );
      roleId = createdRole.id;
      console.log(`  + role ${def.name}`);
    } else {
      console.log(`  = role ${def.name} already exists`);
    }
    await ensureAccess(client, roleId, policyId);
  }

  await replacePermissions(client, policyId, def.rules);
  console.log(`  = ${def.rules.length} permission rule(s) applied for ${def.name}`);
}

/**
 * The Express server authenticates to Directus with one long-lived static
 * token rather than a login/refresh flow. That token has to live on a
 * directus_users row — this provisions a dedicated, non-human account and
 * prints its token once, to be pasted into the app's .env as
 * DIRECTUS_SERVICE_TOKEN. Re-running never rotates an existing token.
 */
async function ensureServiceAccount(client: Client): Promise<void> {
  const roleName = `${env.APP_NAME} Service`;
  const serviceRoleId = await findRoleByName(client, roleName);
  if (!serviceRoleId) {
    throw new Error(`${roleName} role missing — ensurePolicy should have created it.`);
  }

  const existing = await client.request(
    readUsers({ filter: { email: { _eq: env.SERVICE_ACCOUNT_EMAIL } }, fields: ["id", "token"], limit: 1 }),
  );

  if (existing[0]) {
    if (!existing[0].token) {
      const token = randomBytes(32).toString("hex");
      await client.request(updateUser(existing[0].id, { token }, { fields: ["id"] }));
      console.log(`  = service account exists, generated missing token: ${token}`);
    } else {
      console.log("  = service account already exists (token unchanged)");
    }
    return;
  }

  const token = randomBytes(32).toString("hex");
  await client.request(
    createUser(
      {
        email: env.SERVICE_ACCOUNT_EMAIL,
        first_name: env.APP_NAME,
        last_name: "Service Account",
        role: serviceRoleId,
        status: "active",
        token,
      },
      { fields: ["id"] },
    ),
  );
  console.log("  + service account created");
  console.log(`\n  DIRECTUS_SERVICE_TOKEN=${token}`);
  console.log("  Paste this into the app's .env — it is not shown again.\n");
}

async function main(): Promise<void> {
  console.log(`Applying ${env.APP_NAME} permissions to ${env.DIRECTUS_URL}...`);
  const client = await getSchemaClient();

  console.log("\nPolicies + roles");
  for (const def of allPolicies) {
    await ensurePolicy(client, def);
  }

  console.log("\nService account");
  await ensureServiceAccount(client);

  console.log("\nPermissions apply complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
