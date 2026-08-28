import {
  createCollection,
  createField,
  createRelation,
  readCollections,
  readFieldsByCollection,
  readRelation,
  updateCollection,
} from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { env } from "../lib/env.js";
import { HRC_FOLDER, allCollections } from "./definitions.js";
import type { CollectionDefinition, FieldDefinition } from "./types.js";

type Client = Awaited<ReturnType<typeof getSchemaClient>>;

/**
 * The SDK's generated `DirectusCollection.schema`/`DirectusField.schema`
 * types forbid `null`, but the Directus REST API requires an explicit
 * `schema: null` both to create a collection *folder* (no table) and to
 * create an alias field (o2m/m2m/presentation — no column). These casts
 * target the library's own declared parameter types, not `unknown`/`any`.
 */
type CreateFieldInput = Parameters<typeof createField>[1];
type CreateCollectionInput = Parameters<typeof createCollection>[0];

/**
 * This Directus instance is shared with unrelated projects. Every name this
 * tooling touches must be one of ours, and the cheapest way to guarantee
 * that is to refuse to run at all if a definition strays outside the `hrc_`
 * prefix — a typo in `definitions.ts` should fail here, loudly, rather than
 * silently add a field to another project's collection.
 */
const HRC_PREFIX = "hrc_";

function assertOwnedNames(): void {
  const strays = allCollections
    .map((def) => def.collection)
    .filter((name) => !name.startsWith(HRC_PREFIX));

  if (strays.length > 0) {
    throw new Error(
      `Refusing to run: these collections are not prefixed "${HRC_PREFIX}" and would risk ` +
        `colliding with another project on this shared instance — ${strays.join(", ")}`,
    );
  }

  // Relations may legitimately point at Directus's own system collections
  // (directus_files for uploads), but never at another project's tables.
  const foreignTargets = allCollections
    .flatMap((def) => def.relationFields.map((rf) => rf.relation.related_collection))
    .filter((name) => !name.startsWith(HRC_PREFIX) && !name.startsWith("directus_"));

  if (foreignTargets.length > 0) {
    throw new Error(
      `Refusing to run: relations target collections owned by another project — ${[...new Set(foreignTargets)].join(", ")}`,
    );
  }
}

function toDirectusField(def: FieldDefinition): CreateFieldInput {
  return {
    field: def.field,
    type: def.type,
    meta: def.meta ?? {},
    schema: def.schema === null ? null : (def.schema ?? {}),
  } as CreateFieldInput;
}

/**
 * Creates the `hrc_club` folder — a Directus collection row with no table
 * behind it (`schema: null`), which the admin panel renders as a
 * collapsible group. Every collection below sets `meta.group` to it, which
 * is what keeps 24 club collections from being scattered through this
 * instance's alphabetical list of 60-odd.
 */
async function ensureFolder(client: Client, existing: Set<string>): Promise<void> {
  if (existing.has(HRC_FOLDER)) {
    console.log(`  = folder ${HRC_FOLDER} already exists`);
    return;
  }

  await client.request(
    createCollection({
      collection: HRC_FOLDER,
      meta: {
        icon: "sports_tennis",
        note: `${env.APP_NAME} — club website collections.`,
        group: null,
        collapse: "open",
      },
      schema: null,
    } as CreateCollectionInput),
  );
  console.log(`  + created folder ${HRC_FOLDER}`);
}

async function ensureCollection(
  client: Client,
  existing: Set<string>,
  groups: Map<string, string | null>,
  def: CollectionDefinition,
): Promise<void> {
  if (existing.has(def.collection)) {
    console.log(`  = collection ${def.collection} already exists`);
    // Only ever re-files one of our own collections, and only when it is
    // not already filed somewhere — never moves a collection a human has
    // deliberately put elsewhere.
    if (groups.get(def.collection) == null) {
      await client.request(updateCollection(def.collection, { meta: { group: HRC_FOLDER } }));
      console.log(`  ~ filed ${def.collection} under ${HRC_FOLDER}`);
    }
    return;
  }

  await client.request(
    createCollection({
      collection: def.collection,
      meta: {
        icon: def.icon,
        note: def.note,
        group: HRC_FOLDER,
        singleton: def.singleton ?? false,
        display_template: def.displayTemplate ?? null,
        sort_field: def.sortField ?? null,
      },
      schema: {},
      fields: def.fields.map(toDirectusField),
    }),
  );
  console.log(`  + created collection ${def.collection}`);
}

async function ensureBaseFields(
  client: Client,
  collection: string,
  fields: FieldDefinition[],
): Promise<void> {
  const currentFields = await client.request(readFieldsByCollection(collection));
  const currentNames = new Set(currentFields.map((f) => f.field));

  for (const field of fields) {
    if (currentNames.has(field.field)) continue;
    await client.request(createField(collection, toDirectusField(field)));
    console.log(`  + field ${collection}.${field.field}`);
  }
}

async function relationExists(client: Client, collection: string, field: string): Promise<boolean> {
  try {
    await client.request(readRelation(collection, field));
    return true;
  } catch {
    return false;
  }
}

async function ensureRelationFields(client: Client, def: CollectionDefinition): Promise<void> {
  const currentFields = await client.request(readFieldsByCollection(def.collection));
  const currentNames = new Set(currentFields.map((f) => f.field));

  for (const { field, relation } of def.relationFields) {
    if (!currentNames.has(field.field)) {
      await client.request(createField(def.collection, toDirectusField(field)));
      console.log(`  + relation field ${def.collection}.${field.field}`);
    }

    if (relation.oneField) {
      const relatedFields = await client.request(readFieldsByCollection(relation.related_collection));
      const relatedNames = new Set(relatedFields.map((f) => f.field));
      if (!relatedNames.has(relation.oneField)) {
        await client.request(
          createField(
            relation.related_collection,
            toDirectusField({
              field: relation.oneField,
              type: "alias",
              meta: { special: ["o2m"], interface: "list-o2m", options: { enableSelect: false } },
              schema: null,
            }),
          ),
        );
        console.log(`  + o2m alias ${relation.related_collection}.${relation.oneField}`);
      }
    }

    if (await relationExists(client, relation.collection, relation.field)) {
      console.log(`  = relation ${relation.collection}.${relation.field} already exists`);
      continue;
    }

    await client.request(
      createRelation({
        collection: relation.collection,
        field: relation.field,
        related_collection: relation.related_collection,
        meta: {
          one_field: relation.oneField ?? null,
          one_deselect_action: relation.onDelete === "CASCADE" ? "delete" : "nullify",
        },
        // `meta.one_deselect_action` only controls Directus's own o2m
        // deselect behaviour; the actual DB-level foreign key constraint is
        // this `schema` block.
        schema: { on_delete: relation.onDelete ?? "SET NULL" },
      }),
    );
    console.log(`  + relation ${relation.collection}.${relation.field} -> ${relation.related_collection}`);
  }
}

async function main(): Promise<void> {
  assertOwnedNames();

  console.log(`Applying ${env.APP_NAME} schema to ${env.DIRECTUS_URL}...`);
  const client = await getSchemaClient();

  const collections = await client.request(readCollections());
  const existing = new Set(collections.map((c) => c.collection));
  const groups = new Map<string, string | null>(
    collections.map((c) => [c.collection, ((c.meta as { group?: string | null } | null)?.group ?? null)]),
  );

  console.log(`\nPass 1/3 — folder`);
  await ensureFolder(client, existing);

  console.log("\nPass 2/3 — collections + base fields");
  for (const def of allCollections) {
    await ensureCollection(client, existing, groups, def);
    if (existing.has(def.collection)) {
      await ensureBaseFields(client, def.collection, def.fields);
    }
  }

  console.log("\nPass 3/3 — relation fields + relations");
  for (const def of allCollections) {
    await ensureRelationFields(client, def);
  }

  console.log(`\nSchema apply complete — ${allCollections.length} collections under ${HRC_FOLDER}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
