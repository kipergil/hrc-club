import { createItem, createItems, deleteItems, readItems } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { toSlug } from "./parse-club-page.js";
import { parseAveragesPage, parseHandicapsPage, type AveragesPage } from "./parse-averages.js";

/**
 * Imports past seasons' final averages and handicaps into `hrc_player_stats`.
 *
 * The current season's averages are worked out from the match cards; the
 * seasons before them exist only as the league published them, at
 * `Averages{year}.htm` (2021-22 onwards) and `Handicaps{year}.htm` (the
 * last two seasons). This is what gives a player's statistics page more
 * than one season to compare.
 *
 * Names become members by exact match only — in the player's own club
 * first, then anywhere if exactly one member has the name (somebody who
 * has since moved clubs). A name that matches nobody is a player who has
 * since left the league; they are added as a lapsed member, so their
 * record has a profile to sit on and a name to link. Possible duplicates
 * are listed at the end for a person to check rather than guessed at:
 * "Andy Nash" and "Sandy Nash" are one letter apart and two people.
 *
 * Safe to re-run. Each season's rows are replaced wholesale, so a
 * correction on the league's page comes through on the next run.
 *
 *   npm run import:averages             # import
 *   npm run import:averages -- --dry-run  # read and match, write nothing
 */

const BASE = "http://hertsttl.org.uk";
const AVERAGES_YEARS = [2021, 2022, 2023, 2024, 2025] as const;
const DRY_RUN = process.argv.includes("--dry-run");

type Row = Record<string, any>;
type Client = Awaited<ReturnType<typeof getSchemaClient>>;

async function fetchPage(url: string): Promise<string | null> {
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return new TextDecoder("windows-1252").decode(await response.arrayBuffer());
}

const labelFor = (year: number) => `${year}-${String((year + 1) % 100).padStart(2, "0")}`;

/** Edits between two names — for the possible-duplicates report only, never for matching. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length]!;
}

async function readAll(client: Client, collection: string, fields: unknown[], filter?: Row): Promise<Row[]> {
  return (await client.request(
    readItems(collection as never, { fields, ...(filter ? { filter } : {}), limit: -1 } as never),
  )) as Row[];
}

async function main(): Promise<void> {
  console.log(`Importing past seasons' averages from ${BASE}${DRY_RUN ? " — dry run, nothing will be written" : ""}\n`);

  const client = await getSchemaClient();
  const [clubs, members, seasons] = await Promise.all([
    readAll(client, "hrc_clubs", ["id", "name", "slug"]),
    readAll(client, "hrc_members", ["id", "full_name", "slug", "club", "status"]),
    readAll(client, "hrc_seasons", ["id", "label"]),
  ]);

  const clubByName = new Map(clubs.map((club) => [String(club.name).toLowerCase(), club]));
  // The league sometimes names the team where the club belongs —
  // "Cheshunt A of ... club" — so a trailing team letter is dropped.
  const clubOf = (name: string): Row | null =>
    clubByName.get(name.toLowerCase()) ?? clubByName.get(name.replace(/\s+[A-Z]$/, "").toLowerCase()) ?? null;
  const seasonByLabel = new Map(seasons.map((season) => [season.label as string, season]));
  const slugs = new Set(members.map((member) => member.slug as string));
  const byName = new Map<string, Row[]>();
  const index = (member: Row) => {
    const key = String(member.full_name).toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), member]);
  };
  members.forEach(index);

  const created: Array<{ name: string; club: string; season: string }> = [];
  const movedClub: string[] = [];

  async function memberFor(name: string, clubName: string, season: string): Promise<string> {
    const club = clubOf(clubName);
    const named = byName.get(name.toLowerCase()) ?? [];
    const inClub = club ? named.filter((member) => member.club === club.id) : [];
    if (inClub.length === 1) return inClub[0]!.id;
    if (inClub.length === 0 && named.length === 1) {
      // Reported only when the club still exists: a player of a club that has
      // since left the league has nowhere else to be.
      if (club && named[0]!.club !== null) movedClub.push(`${name} — ${clubName} in ${season}, now listed elsewhere`);
      return named[0]!.id;
    }

    // Somebody who has left the league since. Added, lapsed, so the record
    // has a profile; a re-registration later is matched by the same slug.
    let slug = toSlug(name);
    if (slugs.has(slug)) slug = `${slug}-${club?.slug ?? toSlug(clubName)}`;
    for (let n = 2; slugs.has(slug); n += 1) slug = `${toSlug(name)}-${n}`;
    slugs.add(slug);

    const payload = {
      full_name: name,
      slug,
      club: club?.id ?? null,
      status: "lapsed",
      show_on_site: true,
    };
    const member = DRY_RUN
      ? { id: `new:${slug}`, ...payload }
      : ((await client.request(createItem("hrc_members" as never, payload as never))) as Row);
    index(member);
    created.push({ name, club: clubName, season });
    return member.id;
  }

  const summary: string[] = [];

  for (const year of AVERAGES_YEARS) {
    const averagesSource = await fetchPage(`${BASE}/Averages${year}.htm`);
    if (!averagesSource) {
      summary.push(`${labelFor(year)}: no averages page on the league's site — skipped`);
      continue;
    }
    const page: AveragesPage = parseAveragesPage(averagesSource);
    const label = page.seasonLabel ?? labelFor(year);
    const season = seasonByLabel.get(label);
    if (!season) {
      summary.push(`${label}: no such season in Directus — skipped`);
      continue;
    }

    const handicapSource = await fetchPage(`${BASE}/Handicaps${year}.htm`);
    const { handicaps } = handicapSource ? parseHandicapsPage(handicapSource) : { handicaps: new Map<string, number>() };

    const rows: Row[] = [];
    const now = new Date().toISOString();
    for (const { division, players } of page.divisions) {
      for (const player of players) {
        rows.push({
          member: await memberFor(player.name, player.club, label),
          season: season.id,
          team: null,
          division,
          played: player.played,
          won: player.won,
          lost: player.lost,
          win_percentage: player.winPercentage,
          matches_played: player.matchesPlayed,
          team_matches: player.teamMatches,
          meets_participation_threshold: player.eligible,
          handicap: handicaps.get(player.name) ?? null,
          last_synced_at: now,
        });
      }
    }

    // A player listed in two divisions (playing up) is two rows the league
    // prints separately, and is kept as two.
    if (!DRY_RUN) {
      const existing = await readAll(client, "hrc_player_stats", ["id"], { season: { _eq: season.id } });
      if (existing.length > 0) {
        await client.request(deleteItems("hrc_player_stats" as never, existing.map((row) => row.id) as never));
      }
      for (let start = 0; start < rows.length; start += 100) {
        await client.request(createItems("hrc_player_stats" as never, rows.slice(start, start + 100) as never));
      }
    }

    const rated = rows.filter((row) => row.handicap !== null).length;
    summary.push(
      `${label}: ${rows.length} players across ${page.divisions.length} divisions` +
        `${handicapSource ? `, ${rated} with a handicap` : ", no handicaps published"}`,
    );
  }

  for (const line of summary) console.log(`  = ${line}`);

  if (created.length > 0) {
    console.log(`\n  + ${created.length} former player(s) added as lapsed members, for their records`);
  }
  if (movedClub.length > 0) {
    console.log(`\n  ~ matched to a member now at another club (${movedClub.length}):`);
    for (const line of movedClub) console.log(`      ${line}`);
  }

  // Possible duplicates: a new name one or two letters from an existing
  // member at the same club. Not merged — reported, for a person to decide.
  const suspects: string[] = [];
  for (const entry of created) {
    const club = clubOf(entry.club);
    for (const member of members) {
      if (club && member.club !== club.id) continue;
      const gap = distance(entry.name.toLowerCase(), String(member.full_name).toLowerCase());
      if (gap > 0 && gap <= 2) suspects.push(`"${entry.name}" (${entry.club}, ${entry.season}) — or is this "${member.full_name}"?`);
    }
  }
  if (suspects.length > 0) {
    console.log(`\n  ? possible spelling variants, added separately — check and merge by hand if the same person (${suspects.length}):`);
    for (const line of suspects) console.log(`      ${line}`);
  }

  console.log(`\nAverages import ${DRY_RUN ? "dry run " : ""}complete.`);
}

main()
  .catch((error) => {
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
