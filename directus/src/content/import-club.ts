import {
  createItem,
  deleteItems,
  readItems,
  readSingleton,
  updateItem,
  updateSingleton,
} from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { parseClubPage, parseVenue, toSlug } from "./parse-club-page.js";

/**
 * Imports the club's real venue, teams, captains and squads from the
 * league's own club page, and removes the placeholder rows the seed script
 * created.
 *
 * The league site is the source of truth for all of this: it is where
 * registrations are recorded, so a squad list here that disagrees with it
 * is simply wrong. Parsing it at run time rather than transcribing it once
 * means a re-run picks up a new registration, a team folding, or a change
 * of captain.
 *
 * What it deliberately does *not* import: the email and telephone number
 * beside each captain. The league gates those behind a login, and copying
 * them onto a public page would republish contact details their owners
 * gave to the league, not to us.
 *
 * The parsing is defensive but the markup is Microsoft FrontPage output
 * from a Classic ASP page with no promise of stability, so the script
 * fails loudly on anything it does not recognise rather than writing a
 * half-empty club into Directus.
 */

const SOURCE_URL = "http://hertsttl.org.uk/Clubz.asp?Club=HRC";

type Row = Record<string, any>;
type Client = Awaited<ReturnType<typeof getSchemaClient>>;

// ---------------------------------------------------------------------------
// Applying
// ---------------------------------------------------------------------------

async function findOne(client: Client, collection: string, filter: Row): Promise<Row | null> {
  const rows = (await client.request(
    readItems(collection as never, { fields: ["*"], filter, limit: 1 } as never),
  )) as Row[];
  return rows[0] ?? null;
}

async function removeAll(client: Client, collection: string, reason: string): Promise<void> {
  const rows = (await client.request(
    readItems(collection as never, { fields: ["id"], limit: -1 } as never),
  )) as Row[];
  if (rows.length === 0) return;
  await client.request(deleteItems(collection as never, rows.map((r) => r.id) as never));
  console.log(`  - ${collection}: removed ${rows.length} row(s) — ${reason}`);
}

async function main(): Promise<void> {
  console.log(`Importing HRC's club data from ${SOURCE_URL}\n`);

  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`League site returned HTTP ${response.status}.`);
  // The league site is Windows-1252, and mis-decoding it mangles names.
  const source = new TextDecoder("windows-1252").decode(await response.arrayBuffer());

  const club = parseClubPage(source);
  console.log(`Venue: ${club.venue}`);
  console.log(`Teams: ${club.teams.map((t) => `${t.name} (${t.division})`).join(", ")}`);
  console.log(`Squads: ${club.teams.map((t) => `${t.name} ${t.players.length}`).join(", ")}`);
  if (club.updatedAt) console.log(`League data last updated: ${club.updatedAt}`);
  console.log();

  const client = await getSchemaClient();

  const season = await findOne(client, "hrc_seasons", { is_current: { _eq: true } });
  if (!season) throw new Error("No current season. Run the seed first, or create one in Directus.");

  // -- Invented competitive data ------------------------------------------
  //
  // Removed rather than left alongside the real squads. A fabricated score
  // beside a real player's name is worse than an empty state, and the
  // pages already say plainly when there is nothing to show yet. Real
  // fixtures and results arrive with the league sync.
  console.log("Clearing placeholder data");
  await removeAll(client, "hrc_rubbers", "invented scorecards");
  await removeAll(client, "hrc_fixtures", "invented fixtures and results");
  await removeAll(client, "hrc_standings", "invented league tables");
  await removeAll(client, "hrc_player_stats", "invented averages and handicaps");
  await removeAll(client, "hrc_honours", "invented honours — the real roll of honour needs the club's records");
  await removeAll(client, "hrc_committee_roles", "invented committee — the league page lists team contacts, not officers");
  await removeAll(client, "hrc_membership_options", "invented fees");
  await removeAll(client, "hrc_squads", "rebuilt below from the league's registrations");

  const inventedReport = await findOne(client, "hrc_news", { slug: { _eq: "a-team-open-with-a-win" } });
  if (inventedReport) {
    await client.request(deleteItems("hrc_news" as never, [inventedReport.id] as never));
    console.log("  - hrc_news: removed the invented match report");
  }

  // -- Venue ---------------------------------------------------------------

  const address = parseVenue(club.venue);
  const existingVenue = await findOne(client, "hrc_venues", { is_home_venue: { _eq: true } });
  const venuePayload = {
    name: address.name,
    slug: toSlug(address.name),
    address_line_1: address.addressLine1,
    town: address.town,
    postcode: address.postcode,
    is_home_venue: true,
    map_url: `https://www.google.com/maps/search/${encodeURIComponent(club.venue)}`,
  };

  let venueId: string;
  if (existingVenue) {
    await client.request(updateItem("hrc_venues" as never, existingVenue.id, venuePayload as never));
    venueId = existingVenue.id;
    console.log(`\n  ~ venue updated: ${address.name}, ${address.town ?? ""} ${address.postcode ?? ""}`);
  } else {
    const created = (await client.request(
      createItem("hrc_venues" as never, venuePayload as never),
    )) as Row;
    venueId = created.id;
    console.log(`\n  + venue: ${address.name}`);
  }

  // -- Members -------------------------------------------------------------
  //
  // Every name the league publishes on this page, and nothing else about
  // them. `show_on_site` is set because these names are already public on
  // the league's own site; anything the league keeps behind its login stays
  // out of Directus entirely.
  const everyPlayer = [...new Set(club.teams.flatMap((team) => team.players))];
  const memberIds = new Map<string, string>();

  for (const name of everyPlayer) {
    const slug = toSlug(name);
    const existing = await findOne(client, "hrc_members", { slug: { _eq: slug } });
    if (existing) {
      memberIds.set(name, existing.id);
      continue;
    }
    const created = (await client.request(
      createItem("hrc_members" as never, {
        full_name: name,
        slug,
        status: "active",
        show_on_site: true,
      } as never),
    )) as Row;
    memberIds.set(name, created.id);
  }
  console.log(`  = ${everyPlayer.length} players from the league's registrations`);

  // Placeholder people invented by the seed, now that the real squad is in.
  const allMembers = (await client.request(
    readItems("hrc_members" as never, { fields: ["id", "full_name"], limit: -1 } as never),
  )) as Row[];
  const invented = allMembers.filter((m) => !everyPlayer.includes(m.full_name));
  if (invented.length > 0) {
    await client.request(deleteItems("hrc_members" as never, invented.map((m) => m.id) as never));
    console.log(`  - removed ${invented.length} placeholder member(s)`);
  }

  // -- Teams and squads ----------------------------------------------------

  const keptTeamIds: string[] = [];
  for (const [index, team] of club.teams.entries()) {
    const slug = toSlug(team.name);
    const captainId = team.captain ? (memberIds.get(team.captain) ?? null) : null;
    const payload = {
      name: team.name,
      slug,
      division: team.division,
      home_night: team.homeNight || null,
      season: season.id,
      captain: captainId,
      home_venue: venueId,
      league_team_ref: team.name,
      is_active: true,
      sort: index + 1,
      description: null,
    };

    const existing = await findOne(client, "hrc_teams", { slug: { _eq: slug } });
    let teamId: string;
    if (existing) {
      await client.request(updateItem("hrc_teams" as never, existing.id, payload as never));
      teamId = existing.id;
    } else {
      const created = (await client.request(
        createItem("hrc_teams" as never, payload as never),
      )) as Row;
      teamId = created.id;
    }
    keptTeamIds.push(teamId);

    for (const [order, playerName] of team.players.entries()) {
      const memberId = memberIds.get(playerName);
      if (!memberId) continue;
      await client.request(
        createItem("hrc_squads" as never, {
          team: teamId,
          member: memberId,
          season: season.id,
          role: playerName === team.captain ? "captain" : "player",
          sort: order,
          is_active: true,
        } as never),
      );
    }

    const captainNote = team.captain ? `captain ${team.captain}` : "no captain listed";
    console.log(`  = ${team.name}: ${team.division}, ${team.homeNight}s, ${team.players.length} players, ${captainNote}`);
  }

  // A team the seed invented that the league does not list.
  const allTeams = (await client.request(
    readItems("hrc_teams" as never, { fields: ["id", "name"], limit: -1 } as never),
  )) as Row[];
  const strayTeams = allTeams.filter((t) => !keptTeamIds.includes(t.id));
  if (strayTeams.length > 0) {
    await client.request(deleteItems("hrc_teams" as never, strayTeams.map((t) => t.id) as never));
    console.log(`  - removed ${strayTeams.length} team(s) the league does not list`);
  }

  // -- Sessions ------------------------------------------------------------
  //
  // The only session the league page evidences is the match night. The
  // invented club nights and coaching sessions go, because "come along on
  // Tuesday" is a worse answer than "ask us" when nobody has checked.
  await removeAll(client, "hrc_sessions", "invented timetable");
  const matchNight = club.teams[0]?.homeNight;
  if (matchNight) {
    await client.request(
      createItem("hrc_sessions" as never, {
        name: "League match night",
        day_of_week: matchNight,
        start_time: "19:30:00",
        session_type: "league_match",
        venue: venueId,
        suitable_for: "Members playing for one of our four teams. Spectators are welcome.",
        notes:
          "This is the night the league lists for all four HRC teams. If the club also runs practice or coaching sessions, add them here — the league site does not record them.",
        is_active: true,
        sort: 1,
      } as never),
    );
    console.log(`  + session: league match night, ${matchNight}s`);
  }

  // -- Site settings -------------------------------------------------------

  const settings = (await client.request(readSingleton("hrc_site_settings" as never))) as Row;
  await client.request(
    updateSingleton("hrc_site_settings" as never, {
      club_name: settings?.club_name || "HRC Table Tennis Club",
      short_name: "HRC",
      strapline: `Table tennis at ${address.name}, ${address.town ?? "Wormley"}`,
      // The league site never expands "HRC", so nothing here invents a
      // meaning for it, and the founding year is left empty rather than
      // guessed.
      founded_year: null,
      about_summary: `HRC runs four teams in the Hertford & District Table Tennis League — two in the Premier Division, one in Division One and one in Division Two. We play at ${address.name} on ${matchNight ?? "match"} nights.\n\nPLACEHOLDER — replace with the club's own words, and tell us what HRC stands for: the league site never says.`,
      contact_email: null,
      league_url: "https://hertsttl.org.uk",
      current_season: season.id,
    } as never),
  );
  console.log("  ~ site settings updated from the league's data");

  console.log(`\nImport complete. Source: ${SOURCE_URL}`);
  console.log(
    "Fixtures, results, tables and averages are deliberately empty — they arrive with the league sync.",
  );
}

// Only runs when invoked directly, so the parser above can be imported by
// its tests without the import itself talking to Directus.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => process.exit(process.exitCode ?? 0));
}
