import { readItems, updateItem } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { discoverClubRefs, extractVisitorNote, toSlug } from "./parse-club-page.js";

/**
 * Refreshes just the clubs' notes to visiting teams.
 *
 * `import:league` already carries this field, and is the right thing to
 * run in September. This exists for the rest of the year: a club changing
 * its hall hours in January should not require an import that rebuilds
 * every squad in the league, deletes the teams it no longer finds, and
 * rewrites twenty-six team rows — a lot of blast radius for one sentence.
 *
 * Writes `null` as readily as it writes text. A club that takes its note
 * down has said something, and a run that only ever added would leave the
 * site telling visitors the hall shuts at ten for years after it stopped.
 */

const BASE = "http://hertsttl.org.uk";
const INDEX_URL = `${BASE}/Home.htm`;

type Row = { id: string; slug: string; name: string; visitor_note: string | null };

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  // The league's pages are Windows-1252; decoding them as UTF-8 turns
  // every apostrophe the webmaster typed into a replacement character.
  return new TextDecoder("windows-1252").decode(await response.arrayBuffer());
}

async function main(): Promise<void> {
  const refs = discoverClubRefs(await fetchPage(INDEX_URL));
  if (refs.length === 0) throw new Error("Found no club links on the league home page.");

  const client = await getSchemaClient();
  const clubs = (await client.request(
    readItems("hrc_clubs" as never, {
      fields: ["id", "slug", "name", "visitor_note"],
      limit: -1,
    } as never),
  )) as Row[];
  const bySlug = new Map(clubs.map((club) => [club.slug, club]));

  let changed = 0;
  for (const ref of refs) {
    const club = bySlug.get(toSlug(ref));
    if (!club) {
      console.warn(`  ! ${ref}: no club with slug "${toSlug(ref)}" — run import:league first`);
      continue;
    }

    const note = extractVisitorNote(await fetchPage(`${BASE}/Clubz.asp?Club=${encodeURIComponent(ref)}`));
    if ((club.visitor_note ?? null) === note) {
      console.log(`  = ${club.name}${note ? "" : " (no note)"}`);
      continue;
    }

    await client.request(updateItem("hrc_clubs" as never, club.id, { visitor_note: note } as never));
    console.log(`  ${note ? "+" : "-"} ${club.name}${note ? `: ${note.split("\n")[0]!.slice(0, 60)}…` : " (note removed)"}`);
    changed += 1;
  }

  console.log(`\nClub notes: ${changed} changed, ${refs.length - changed} unchanged.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
