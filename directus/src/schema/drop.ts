import { deleteCollection, deleteField, readItems } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { allCollections } from "./definitions.js";

/**
 * Drops a collection so `schema:apply` can rebuild it from the definitions.
 *
 * `schema:apply` only ever creates. That is deliberate — this Directus
 * instance is shared with unrelated projects, and tooling that updates or
 * deletes what it did not create is tooling that can damage someone else's
 * data model. The cost is that a field which needs to *change* cannot be
 * changed by re-running it: `hrc_fixtures.opponent_name` was created
 * `required`, and no amount of re-applying will relax it.
 *
 * So this exists as a separate, deliberate step, with the two guards that
 * make it safe to run:
 *
 *   1. The name must be one this project owns and defines.
 *   2. The collection must be empty. Dropping a table with rows in it is
 *      not a schema change, it is data loss, and this refuses to do it.
 *
 * Usage:  npm run schema:drop -- hrc_fixtures hrc_standings
 */

const owned = new Set(allCollections.map((definition) => definition.collection));

/** What each collection points at, among the ones being dropped. */
function referencesWithin(name: string, within: string[]): string[] {
  const definition = allCollections.find((candidate) => candidate.collection === name);
  return (definition?.relationFields ?? [])
    .map((relationField) => relationField.relation.related_collection ?? "")
    .filter((target) => target !== name && within.includes(target));
}

/**
 * Referencing collections first, referenced ones last, so a drop never
 * trips over a foreign key from another collection in the same run.
 */
function ordered(names: string[]): string[] {
  const remaining = [...names];
  const result: string[] = [];

  while (remaining.length > 0) {
    // Something nothing else still points at can go now.
    const index = remaining.findIndex(
      (name) => !remaining.some((other) => other !== name && referencesWithin(other, remaining).includes(name)),
    );
    if (index === -1) {
      // A cycle. Nothing in this schema has one, and if that changes the
      // right answer is to say so rather than fail halfway through.
      throw new Error(
        `Refusing to run: ${remaining.join(", ")} reference each other in a cycle, so there is no ` +
          "safe order to drop them in. Remove one of the relations first.",
      );
    }
    result.push(...remaining.splice(index, 1));
  }
  return result;
}

async function main(): Promise<void> {
  const names = process.argv.slice(2).filter((argument) => !argument.startsWith("-"));

  if (names.length === 0) {
    console.error("Usage: npm run schema:drop -- <collection> [collection...]");
    process.exitCode = 1;
    return;
  }

  const strays = names.filter((name) => !owned.has(name));
  if (strays.length > 0) {
    throw new Error(
      `Refusing to run: ${strays.join(", ")} ${strays.length === 1 ? "is" : "are"} not defined by ` +
        "this project. This instance is shared, and dropping another project's collection is not " +
        "something a typo should be able to do.",
    );
  }

  const client = await getSchemaClient();

  // Checked for every collection before any is dropped, so a run either
  // makes sense as a whole or does nothing at all.
  for (const name of names) {
    const rows = (await client.request(
      readItems(name as never, { fields: ["id"], limit: 1 } as never),
    )) as unknown[];

    if (rows.length > 0) {
      throw new Error(
        `Refusing to drop ${name}: it has rows in it. Dropping a populated collection is data ` +
          "loss, not a schema change. Export or clear it first, deliberately.",
      );
    }
  }

  /*
   * A foreign key pointing at the table blocks the drop, so the referencing
   * columns have to go first — and they carry the same risk, so they carry
   * the same guard: a column with a value in it anywhere is a column whose
   * removal loses something, and this refuses.
   *
   * Only relations this project defines are considered. A dependent from
   * another project on this shared instance is not ours to remove, and the
   * drop is left to fail loudly instead.
   */
  const dependents = allCollections.flatMap((definition) =>
    definition.relationFields
      .filter((relationField) => names.includes(relationField.relation.related_collection ?? ""))
      .map((relationField) => ({
        collection: definition.collection,
        field: relationField.field.field,
      }))
      // A collection being dropped anyway takes its own columns with it.
      .filter((dependent) => !names.includes(dependent.collection)),
  );

  for (const dependent of dependents) {
    const holding = (await client.request(
      readItems(dependent.collection as never, {
        fields: ["id"],
        filter: { [dependent.field]: { _nnull: true } },
        limit: 1,
      } as never),
    )) as unknown[];

    if (holding.length > 0) {
      throw new Error(
        `Refusing to drop: ${dependent.collection}.${dependent.field} points at it and has rows ` +
          "using it. Clear those references first, deliberately.",
      );
    }
  }

  for (const dependent of dependents) {
    await client.request(deleteField(dependent.collection, dependent.field));
    console.log(`  - dropped ${dependent.collection}.${dependent.field} (pointed at a dropped collection)`);
  }

  /*
   * Order matters when two of the named collections reference each other:
   * dropping `hrc_teams` before `hrc_squads` fails, because squads still
   * hold a foreign key to teams. So a collection is dropped only once
   * nothing left in the list points at it.
   */
  for (const name of ordered(names)) {
    await client.request(deleteCollection(name));
    console.log(`  - dropped ${name}`);
  }

  console.log(
    `\nDropped ${names.length} empty ${names.length === 1 ? "collection" : "collections"}. ` +
      "Run `npm run schema:apply` to rebuild from definitions.ts.",
  );
}

main()
  .catch((error) => {
    /*
     * Directus SDK errors carry their detail in `errors[]` and leave
     * `message` undefined, so printing the message alone reports a failure
     * as the word "undefined" — which is how the first run of this looked
     * like it had worked.
     */
    const detail =
      (error as { errors?: { message?: string }[] })?.errors
        ?.map((item) => item.message)
        .filter(Boolean)
        .join("; ") ||
      (error as Error)?.message ||
      JSON.stringify(error);
    console.error(`\n${detail}\n`);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
