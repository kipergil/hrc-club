import { createItem, deleteItems, readItems, updateItem } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import {
  discoverClubRefs,
  parseClubPage,
  parseVenue,
  toSlug,
  type ClubInfo,
} from "./parse-club-page.js";

/**
 * Imports every club in the league — venues, teams, captains and squads —
 * from the league's own pages.
 *
 * The league is the source of truth for all of it: registrations are
 * recorded there, so a squad list here that disagrees with it is simply
 * wrong. Parsing at run time rather than transcribing once means a re-run
 * picks up a new registration, a change of captain, a team folding, or a
 * club joining the league.
 *
 * What it deliberately does *not* import: the email and telephone number
 * beside each captain. The league gates those behind a login, and copying
 * them onto a public page would republish contact details their owners gave
 * to the league, not to us. Everything imported here is already public on
 * the league's own site.
 */

const BASE = "http://hertsttl.org.uk";
const INDEX_URL = `${BASE}/Home.htm`;
/** The club whose site this is. Everything "our" on the site reads from it. */
const HOME_CLUB_REF = "HRC";

type Row = Record<string, any>;
type Client = Awaited<ReturnType<typeof getSchemaClient>>;

/** The league site is Windows-1252; mis-decoding it mangles players' names. */
async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return new TextDecoder("windows-1252").decode(await response.arrayBuffer());
}

async function findOne(client: Client, collection: string, filter: Row): Promise<Row | null> {
  const rows = (await client.request(
    readItems(collection as never, { fields: ["*"], filter, limit: 1 } as never),
  )) as Row[];
  return rows[0] ?? null;
}

async function upsert(
  client: Client,
  collection: string,
  match: Row,
  payload: Row,
): Promise<string> {
  const existing = await findOne(client, collection, match);
  if (existing) {
    await client.request(updateItem(collection as never, existing.id, payload as never));
    return existing.id;
  }
  const created = (await client.request(
    createItem(collection as never, { ...payload } as never),
  )) as Row;
  return created.id;
}

async function main(): Promise<void> {
  console.log(`Importing the league from ${BASE}\n`);

  const index = await fetchPage(INDEX_URL);
  const refs = discoverClubRefs(index);
  if (refs.length === 0) throw new Error("Found no club links on the league home page.");
  console.log(`Found ${refs.length} clubs: ${refs.join(", ")}\n`);

  const clubs: Array<{ ref: string; info: ClubInfo }> = [];
  for (const ref of refs) {
    const source = await fetchPage(`${BASE}/Clubz.asp?Club=${encodeURIComponent(ref)}`);
    try {
      clubs.push({ ref, info: parseClubPage(source) });
    } catch (error) {
      // One unreadable club page should not cost the other nine. It is
      // still loud: a club that silently vanishes from the site is worse
      // than a warning nobody reads.
      console.warn(`  ! ${ref}: ${(error as Error).message}`);
    }
  }
  if (clubs.length === 0) throw new Error("No club page could be parsed — the site layout has changed.");

  const client = await getSchemaClient();
  const season = await findOne(client, "hrc_seasons", { is_current: { _eq: true } });
  if (!season) throw new Error("No current season. Create one in Directus first.");

  // Squads are rebuilt wholesale: a player who left a club has no row to
  // update, so reconciling in place would leave them in the squad for ever.
  const existingSquads = (await client.request(
    readItems("hrc_squads" as never, { fields: ["id"], limit: -1 } as never),
  )) as Row[];
  if (existingSquads.length > 0) {
    await client.request(deleteItems("hrc_squads" as never, existingSquads.map((r) => r.id) as never));
  }

  const seenTeamIds: string[] = [];
  const seenClubIds: string[] = [];
  const seenMemberIds: string[] = [];
  const memberSlugs = new Map<string, string>();
  let venueCount = 0;

  for (const { ref, info } of clubs) {
    const clubName = info.clubName?.trim() || ref;
    const clubSlug = toSlug(clubName);
    /*
     * No club is "ours" on the league's own site.
     *
     * This importer began life on a site belonging to HRC, and flagged
     * them as the home club — which is what `is_home_club` and
     * `is_home_venue` mean. Since the site became the league's, that flag
     * makes the unqualified "teams" and "players" queries return four
     * teams and twenty-eight players out of twenty-six and a hundred and
     * sixty-five, and the league table compute only one division. Re-
     * running the import used to quietly set it again and undo the
     * reframe.
     *
     * The flag stays in the schema: it is what a club deploying this for
     * itself would set. It is simply not this deployment's to set.
     */
    const isHome = false;
    const isHomeClub = ref === HOME_CLUB_REF;

    // Venues are shared: two clubs play out of Stanstead Abbotts Parish
    // Hall, so a hall is matched on its name rather than created per club.
    let venueId: string | null = null;
    if (info.venue) {
      const address = parseVenue(info.venue);
      const venueSlug = toSlug(address.name);
      const before = await findOne(client, "hrc_venues", { slug: { _eq: venueSlug } });
      venueId = await upsert(
        client,
        "hrc_venues",
        { slug: { _eq: venueSlug } },
        {
          name: address.name,
          slug: venueSlug,
          address_line_1: address.addressLine1,
          town: address.town,
          postcode: address.postcode,
          is_home_venue: isHome,
          map_url: `https://www.google.com/maps/search/${encodeURIComponent(info.venue)}`,
        },
      );
      if (!before) venueCount += 1;
    }

    const clubId = await upsert(
      client,
      "hrc_clubs",
      { slug: { _eq: clubSlug } },
      {
        name: clubName,
        slug: clubSlug,
        league_ref: ref,
        is_home_club: isHome,
        venue: venueId,
        sort: isHomeClub ? 0 : 1,
        last_synced_at: new Date().toISOString(),
      },
    );
    seenClubIds.push(clubId);

    for (const [index, team] of info.teams.entries()) {
      // Every player the league publishes for this club, and nothing else
      // about them. `show_on_site` is set because these names are already
      // public on the league's own site.
      const memberIds = new Map<string, string>();
      for (const player of team.players) {
        const base = toSlug(player);
        // Two clubs can register people with the same name, and the slug is
        // unique site-wide, so a collision is qualified by club rather than
        // silently overwriting somebody else's profile.
        const taken = memberSlugs.get(base);
        const slug = !taken || taken === clubId ? base : `${base}-${clubSlug}`;
        memberSlugs.set(slug, clubId);
        if (!taken) memberSlugs.set(base, clubId);

        const id = await upsert(
          client,
          "hrc_members",
          { slug: { _eq: slug } },
          { full_name: player, slug, club: clubId, status: "active", show_on_site: true },
        );
        memberIds.set(player, id);
        seenMemberIds.push(id);
      }

      const teamSlug = toSlug(team.name);
      const teamId = await upsert(
        client,
        "hrc_teams",
        { slug: { _eq: teamSlug } },
        {
          name: team.name,
          slug: teamSlug,
          club: clubId,
          division: team.division,
          home_night: team.homeNight || null,
          season: season.id,
          captain: team.captain ? (memberIds.get(team.captain) ?? null) : null,
          home_venue: venueId,
          league_team_ref: team.name,
          is_active: true,
          sort: index + 1,
        },
      );
      seenTeamIds.push(teamId);

      for (const [order, player] of team.players.entries()) {
        const memberId = memberIds.get(player);
        if (!memberId) continue;
        await client.request(
          createItem("hrc_squads" as never, {
            team: teamId,
            member: memberId,
            season: season.id,
            role: player === team.captain ? "captain" : "player",
            sort: order,
            is_active: true,
          } as never),
        );
      }
    }

    const players = info.teams.reduce((total, team) => total + team.players.length, 0);
    console.log(
      `  = ${clubName.padEnd(20)} ${String(info.teams.length).padStart(2)} team(s), ${String(players).padStart(3)} squad places${isHomeClub ? "   (HRC, this repository\u2019s namesake)" : ""}`,
    );
  }

  // Anything the league no longer lists: a team that folded, a player who
  // left, a club that dropped out. Removed rather than left to rot, because
  // a stale squad list is a wrong squad list.
  for (const [collection, keep, label] of [
    ["hrc_teams", seenTeamIds, "team"],
    ["hrc_members", seenMemberIds, "player"],
    ["hrc_clubs", seenClubIds, "club"],
  ] as const) {
    const all = (await client.request(
      readItems(collection as never, { fields: ["id"], limit: -1 } as never),
    )) as Row[];
    const stale = all.filter((row) => !keep.includes(row.id));
    if (stale.length > 0) {
      await client.request(deleteItems(collection as never, stale.map((r) => r.id) as never));
      console.log(`  - removed ${stale.length} ${label}(s) the league no longer lists`);
    }
  }

  const totals = clubs.reduce(
    (acc, { info }) => ({
      teams: acc.teams + info.teams.length,
      players: acc.players + info.teams.reduce((n, t) => n + t.players.length, 0),
    }),
    { teams: 0, players: 0 },
  );

  console.log(
    `\nImported ${clubs.length} clubs, ${totals.teams} teams, ${totals.players} squad places, ${venueCount} new venue(s).`,
  );
  console.log("Fixtures, results, tables and averages still come from the league sync.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
