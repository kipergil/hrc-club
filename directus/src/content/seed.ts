import { createItem, readItems, readSingleton, updateSingleton } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { env } from "../lib/env.js";

/**
 * Starter content, so the site renders as a site rather than as a grid of
 * empty states.
 *
 * Every row here is placeholder text written to be *obviously* placeholder
 * where it matters — the club's real name, history, fees and committee are
 * things only the club can supply. It exists so the layout, the empty
 * states and the accessibility work can be judged against something
 * realistic, and so a committee member opening Directus for the first time
 * sees the shape of what they are meant to fill in.
 *
 * Idempotent: every row is matched on a natural key (slug, label, name)
 * and skipped if it already exists, so re-running never duplicates. To
 * start again, delete the rows in the admin panel and re-run.
 */

type Row = Record<string, any>;
type Client = Awaited<ReturnType<typeof getSchemaClient>>;

let created = 0;
let skipped = 0;

/**
 * Creates a row unless one already matches. `match` is a plain map of
 * column to value: a single entry for a natural key like a slug, several
 * for a row whose identity is a combination (a standings row is one team,
 * in one division, in one season).
 *
 * The matched columns are written into the new row too, so a caller never
 * has to repeat them in `payload`.
 */
async function ensure(
  client: Client,
  collection: string,
  match: Record<string, unknown>,
  payload: Record<string, unknown> = {},
): Promise<string> {
  const filter = Object.fromEntries(
    Object.entries(match).map(([field, value]) => [field, { _eq: value }]),
  );

  const existing = (await client.request(
    readItems(collection as never, { fields: ["id"], filter: { _and: [filter] }, limit: 1 } as never),
  )) as Row[];

  if (existing[0]) {
    skipped += 1;
    return existing[0].id;
  }

  const row = (await client.request(
    createItem(collection as never, { ...match, ...payload } as never),
  )) as Row;
  created += 1;
  console.log(`  + ${collection}: ${Object.values(match).join(" / ")}`);
  return row.id;
}

const SEASON = "2026-27";
const PREVIOUS_SEASON = "2025-26";

async function main(): Promise<void> {
  console.log(`Seeding ${env.APP_NAME} starter content into ${env.DIRECTUS_URL}...\n`);
  const client = await getSchemaClient();

  // -- Seasons -------------------------------------------------------------

  const seasonId = await ensure(
    client,
    "hrc_seasons",
    { slug: SEASON },
    { label: SEASON, starts_on: "2026-09-01", ends_on: "2027-04-30", is_current: true },
  );
  const previousSeasonId = await ensure(
    client,
    "hrc_seasons",
    { slug: PREVIOUS_SEASON },
    { label: PREVIOUS_SEASON, starts_on: "2025-09-01", ends_on: "2026-04-30", is_current: false },
  );

  // -- Venue ---------------------------------------------------------------

  const venueId = await ensure(
    client,
    "hrc_venues",
    { slug: "hrc-main-hall" },
    {
      name: "HRC main hall",
      address_line_1: "PLACEHOLDER — the club's real address goes here",
      town: "Hertford",
      postcode: "SG14",
      is_home_venue: true,
      table_count: 6,
      directions:
        "The hall is on the left as you come through the main gates. There is a sign on the door on club nights. If you get lost, ring the number on the contact page — someone will come and find you.",
      parking_notes:
        "Free parking on site. The car park fills up on match nights, so allow a few extra minutes if you are playing.",
      accessibility_notes:
        "Step-free access from the car park to the hall. Accessible toilet next to the changing rooms. The hall is well lit and the floor is level throughout. If there is anything you would like to check before coming, please ask — we would rather you asked than wondered.",
    },
  );

  // -- Members -------------------------------------------------------------

  const memberSeeds = [
    { slug: "a-ashworth", full_name: "Alan Ashworth", is_committee: true, joined_year: 1998 },
    { slug: "j-baptiste", full_name: "Jeanette Baptiste", is_committee: true, joined_year: 2004 },
    { slug: "m-chowdhury", full_name: "Meera Chowdhury", is_coach: true, joined_year: 2011 },
    { slug: "d-okafor", full_name: "Daniel Okafor", is_committee: true, joined_year: 2015 },
    { slug: "s-pereira", full_name: "Sunil Pereira", joined_year: 2019 },
    { slug: "r-whitfield", full_name: "Ruth Whitfield", is_committee: true, joined_year: 2007 },
    { slug: "t-nowak", full_name: "Tomasz Nowak", joined_year: 2021 },
    { slug: "e-hargreaves", full_name: "Ellen Hargreaves", joined_year: 2018 },
    { slug: "p-mistry", full_name: "Priya Mistry", is_coach: true, joined_year: 2013 },
    { slug: "g-lindqvist", full_name: "Gustav Lindqvist", joined_year: 2022 },
    { slug: "h-oyelaran", full_name: "Hakeem Oyelaran", joined_year: 2020 },
    { slug: "c-devlin", full_name: "Cathy Devlin", is_committee: true, joined_year: 2009 },
    { slug: "b-tran", full_name: "Bao Tran", joined_year: 2023 },
    { slug: "f-almasi", full_name: "Farhan Almasi", joined_year: 2024 },
  ];

  const members: Record<string, string> = {};
  for (const seed of memberSeeds) {
    const { slug, ...rest } = seed;
    members[slug] = await ensure(client, "hrc_members", { slug }, { ...rest, show_on_site: true });
  }

  // -- Teams and squads ----------------------------------------------------

  const teamSeeds = [
    {
      slug: "hrc-a",
      name: "HRC A",
      division: "premier",
      home_night: "tuesday",
      captain: "a-ashworth",
      sort: 1,
      squad: ["a-ashworth", "m-chowdhury", "d-okafor", "p-mistry"],
      description:
        "Our first team, in the Premier Division. Competitive league table tennis — most of the squad have played for years.",
    },
    {
      slug: "hrc-b",
      name: "HRC B",
      division: "division_1",
      home_night: "thursday",
      captain: "r-whitfield",
      sort: 2,
      squad: ["r-whitfield", "s-pereira", "t-nowak", "e-hargreaves"],
      description:
        "Division 1. A good step up from club nights, and where most players find their level after a season or two.",
    },
    {
      slug: "hrc-c",
      name: "HRC C",
      division: "division_2",
      home_night: "thursday",
      captain: "c-devlin",
      sort: 3,
      squad: ["c-devlin", "g-lindqvist", "h-oyelaran", "b-tran", "f-almasi"],
      description:
        "Division 2, and the team most new members start in. If you have played a bit and fancy a match, this is the one to ask about.",
    },
  ];

  const teams: Record<string, string> = {};
  for (const seed of teamSeeds) {
    teams[seed.slug] = await ensure(
      client,
      "hrc_teams",
      { slug: seed.slug },
      {
        name: seed.name,
        division: seed.division,
        home_night: seed.home_night,
        home_start_time: "19:30:00",
        season: seasonId,
        captain: members[seed.captain],
        home_venue: venueId,
        league_team_ref: seed.name,
        is_active: true,
        sort: seed.sort,
        description: seed.description,
      },
    );

    for (const [index, memberSlug] of seed.squad.entries()) {
      await ensure(
        client,
        "hrc_squads",
        { team: teams[seed.slug], member: members[memberSlug], season: seasonId },
        {
          role: memberSlug === seed.captain ? "captain" : "player",
          sort: index,
          is_active: true,
        },
      );
    }
  }

  // -- Fixtures ------------------------------------------------------------

  const opponents = [
    "Water Lane A",
    "Grundy Park B",
    "St. Andrews A",
    "Stanstead Abbotts C",
    "Furneux Pelham A",
    "Ware Priory B",
  ];

  const fixtureSeeds: Array<{
    ref: string;
    team: string;
    opponent: string;
    date: string;
    week: string;
    home: boolean;
    status: string;
    hrc?: number;
    them?: number;
    competition?: string;
  }> = [
    { ref: "26A01", team: "hrc-a", opponent: opponents[0]!, date: "2026-09-15", week: "2026-09-14", home: true, status: "played", hrc: 7, them: 3 },
    { ref: "26A02", team: "hrc-a", opponent: opponents[1]!, date: "2026-09-22", week: "2026-09-21", home: false, status: "played", hrc: 4, them: 6 },
    { ref: "26A03", team: "hrc-a", opponent: opponents[2]!, date: "2026-09-29", week: "2026-09-28", home: true, status: "played", hrc: 5, them: 5 },
    { ref: "26A04", team: "hrc-a", opponent: opponents[3]!, date: "2026-10-06", week: "2026-10-05", home: false, status: "scheduled" },
    { ref: "26A05", team: "hrc-a", opponent: opponents[4]!, date: "2026-10-13", week: "2026-10-12", home: true, status: "scheduled" },
    { ref: "26B01", team: "hrc-b", opponent: opponents[1]!, date: "2026-09-17", week: "2026-09-14", home: true, status: "played", hrc: 8, them: 2 },
    { ref: "26B02", team: "hrc-b", opponent: opponents[5]!, date: "2026-09-24", week: "2026-09-21", home: false, status: "played", hrc: 6, them: 4 },
    { ref: "26B03", team: "hrc-b", opponent: opponents[2]!, date: "2026-10-08", week: "2026-10-05", home: true, status: "scheduled" },
    { ref: "26C01", team: "hrc-c", opponent: opponents[3]!, date: "2026-09-17", week: "2026-09-14", home: false, status: "played", hrc: 3, them: 7 },
    { ref: "26C02", team: "hrc-c", opponent: opponents[4]!, date: "2026-10-01", week: "2026-09-28", home: true, status: "played", hrc: 6, them: 4 },
    { ref: "26C03", team: "hrc-c", opponent: opponents[5]!, date: "2026-10-15", week: "2026-10-12", home: false, status: "scheduled" },
    { ref: "26CUP1", team: "hrc-a", opponent: opponents[5]!, date: "2026-10-20", week: "2026-10-19", home: true, status: "scheduled", competition: "creasey_cup" },
    { ref: "26CUP2", team: "hrc-b", opponent: opponents[0]!, date: "2026-09-30", week: "2026-09-28", home: false, status: "played", hrc: 5, them: 4, competition: "clifford_troll_trophy" },
  ];

  const fixtures: Record<string, string> = {};
  for (const seed of fixtureSeeds) {
    const result =
      seed.status !== "played"
        ? null
        : seed.hrc! > seed.them!
          ? "win"
          : seed.hrc! < seed.them!
            ? "loss"
            : "draw";

    fixtures[seed.ref] = await ensure(
      client,
      "hrc_fixtures",
      { league_fixture_ref: seed.ref },
      {
        team: teams[seed.team],
        season: seasonId,
        played_on: seed.date,
        week_commencing: seed.week,
        start_time: "19:30:00",
        competition: seed.competition ?? "league",
        opponent_name: seed.opponent,
        is_home: seed.home,
        status: seed.status,
        result,
        hrc_score: seed.hrc ?? null,
        opponent_score: seed.them ?? null,
        venue: seed.home ? venueId : null,
        last_synced_at: new Date().toISOString(),
      },
    );
  }

  // A single fully-detailed card, so the match page has something real to
  // show — the rest carry a score only, which is the normal state.
  const firstFixture = fixtures["26A01"]!;
  const existingRubbers = (await client.request(
    readItems("hrc_rubbers" as never, {
      fields: ["id"],
      filter: { fixture: { _eq: firstFixture } },
      limit: 1,
    } as never),
  )) as Row[];

  if (existingRubbers.length === 0) {
    const rubbers = [
      { n: 1, member: "a-ashworth", opponent: "M. Kaur", for: 3, against: 1, detail: "11-8, 9-11, 11-6, 11-7" },
      { n: 2, member: "m-chowdhury", opponent: "R. Doyle", for: 3, against: 0, detail: "11-4, 11-9, 11-6" },
      { n: 3, member: "d-okafor", opponent: "S. Achebe", for: 1, against: 3, detail: "8-11, 11-9, 6-11, 9-11" },
      { n: 4, member: "p-mistry", opponent: "M. Kaur", for: 3, against: 2, detail: "11-13, 11-8, 6-11, 11-9, 11-7" },
    ];
    for (const rubber of rubbers) {
      await client.request(
        createItem("hrc_rubbers" as never, {
          fixture: firstFixture,
          rubber_number: rubber.n,
          member: members[rubber.member],
          opponent_player_name: rubber.opponent,
          sets_for: rubber.for,
          sets_against: rubber.against,
          won: rubber.for > rubber.against,
          score_detail: rubber.detail,
        } as never),
      );
      created += 1;
    }
    console.log("  + rubbers for the first match");
  } else {
    skipped += 1;
  }

  // -- Standings -----------------------------------------------------------

  const standingSeeds = [
    { division: "premier", rows: ["Water Lane A", "HRC A", "St. Andrews A", "Furneux Pelham A", "Grundy Park B"] },
    { division: "division_1", rows: ["HRC B", "Ware Priory B", "Grundy Park B", "St. Andrews A"] },
    { division: "division_2", rows: ["Furneux Pelham A", "Stanstead Abbotts C", "HRC C", "Ware Priory B"] },
  ];

  for (const division of standingSeeds) {
    for (const [index, teamName] of division.rows.entries()) {
      const played = 3;
      const won = Math.max(0, played - index);
      const lost = played - won;
      await ensure(
        client,
        "hrc_standings",
        { season: seasonId, division: division.division, team_name: teamName },
        {
          position: index + 1,
          is_hrc: teamName.startsWith("HRC"),
          played,
          won,
          drawn: 0,
          lost,
          sets_for: 10 + won * 4,
          sets_against: 10 + lost * 4,
          points: won * 2,
          last_synced_at: new Date().toISOString(),
        },
      );
    }
  }

  // -- Player stats --------------------------------------------------------

  const statSeeds = [
    { member: "a-ashworth", team: "hrc-a", division: "premier", played: 3, won: 9, lost: 3, handicap: 0 },
    { member: "m-chowdhury", team: "hrc-a", division: "premier", played: 3, won: 8, lost: 4, handicap: 1 },
    { member: "d-okafor", team: "hrc-a", division: "premier", played: 3, won: 5, lost: 7, handicap: 3 },
    { member: "p-mistry", team: "hrc-a", division: "premier", played: 2, won: 4, lost: 2, handicap: 2 },
    { member: "r-whitfield", team: "hrc-b", division: "division_1", played: 2, won: 5, lost: 1, handicap: 2 },
    { member: "s-pereira", team: "hrc-b", division: "division_1", played: 2, won: 4, lost: 2, handicap: 4 },
    { member: "t-nowak", team: "hrc-b", division: "division_1", played: 1, won: 1, lost: 2, handicap: 5 },
    { member: "c-devlin", team: "hrc-c", division: "division_2", played: 2, won: 3, lost: 3, handicap: 6 },
    { member: "g-lindqvist", team: "hrc-c", division: "division_2", played: 2, won: 2, lost: 4, handicap: 7 },
    { member: "b-tran", team: "hrc-c", division: "division_2", played: 1, won: 1, lost: 2, handicap: 8 },
  ];

  for (const seed of statSeeds) {
    const total = seed.won + seed.lost;
    await ensure(
      client,
      "hrc_player_stats",
      { member: members[seed.member], season: seasonId },
      {
        team: teams[seed.team],
        division: seed.division,
        played: seed.played,
        won: seed.won,
        lost: seed.lost,
        win_percentage: total === 0 ? 0 : Math.round((seed.won / total) * 10000) / 100,
        handicap: seed.handicap,
        meets_participation_threshold: seed.played >= 2,
        last_synced_at: new Date().toISOString(),
      },
    );
  }

  // -- Sessions ------------------------------------------------------------

  const sessionSeeds = [
    {
      name: "Club night",
      day_of_week: "tuesday",
      start_time: "19:30:00",
      end_time: "22:00:00",
      session_type: "club_night",
      suitable_for: "All abilities, adults and juniors aged 11 and over. Turn up and play — no need to book.",
      cost_note: "£4 for members, £6 for visitors. First evening free.",
      sort: 1,
    },
    {
      name: "Junior coaching",
      day_of_week: "wednesday",
      start_time: "17:30:00",
      end_time: "19:00:00",
      session_type: "junior",
      suitable_for: "Ages 8 to 17, complete beginners very welcome. Bats provided.",
      cost_note: "£5 per session, or £45 for a term.",
      lead_coach: "p-mistry",
      sort: 2,
    },
    {
      name: "Coaching for adults",
      day_of_week: "wednesday",
      start_time: "19:30:00",
      end_time: "21:00:00",
      session_type: "coaching",
      suitable_for: "Any adult who wants to get better, from never-played to league regular.",
      cost_note: "£6 per session.",
      lead_coach: "m-chowdhury",
      sort: 3,
    },
    {
      name: "League match night",
      day_of_week: "thursday",
      start_time: "19:30:00",
      end_time: "22:30:00",
      session_type: "league_match",
      suitable_for: "Members playing for HRC B and HRC C. Spectators always welcome.",
      cost_note: "Free to watch.",
      sort: 4,
    },
  ];

  for (const seed of sessionSeeds) {
    const { lead_coach, ...rest } = seed;
    await ensure(
      client,
      "hrc_sessions",
      { name: seed.name },
      {
        ...rest,
        venue: venueId,
        lead_coach: lead_coach ? members[lead_coach] : null,
        is_active: true,
      },
    );
  }

  // -- Pages ---------------------------------------------------------------

  const pageSeeds = [
    {
      slug: "about",
      title: "About the club",
      subtitle: "Who we are and where we came from",
      nav_group: "about",
      body: "PLACEHOLDER — replace this with the club's own words.\n\nHRC is a table tennis club in Hertford. We run club nights, coaching for adults and juniors, and three teams in the Hertford & District Table Tennis League.\n\nWe are a small, friendly club. Some of our members have played for decades; others picked up a bat for the first time last year. Both are welcome, and both turn up on the same night.",
    },
    {
      slug: "history",
      title: "Our history",
      subtitle: "The club through the years",
      nav_group: "about",
      body: "PLACEHOLDER — this page is waiting for someone who remembers.\n\nIf you have programmes, photographs, newspaper cuttings or a trophy with names engraved on it, we would very much like to hear from you. The roll of honour is only as good as what we can find.",
    },
    {
      slug: "join",
      title: "Join us",
      subtitle: "Membership, fees and how to start",
      nav_group: "play",
      body: "PLACEHOLDER — check these details before publishing.\n\n### How it works\n\nCome along on a club night. Play. See what you think. Nobody is asked to join on their first evening — pay the visitor rate, and sign up once you are sure.\n\n### What to bring\n\nFlat, clean indoor shoes and something you can move in. We will lend you a bat until you want your own.\n\n### If you have never played\n\nThat is completely normal here. Tell whoever is on the door and they will make sure you are playing with someone at your level rather than being fed to a county player.",
    },
    {
      slug: "coaching",
      title: "Coaching",
      subtitle: "Lessons and practice sessions",
      nav_group: "play",
      body: "PLACEHOLDER — confirm coach names and qualifications before publishing.\n\nWe run coaching for adults and for juniors, both on Wednesdays. Sessions are led by qualified coaches and are aimed at people who want to get better, whatever level they are starting from.\n\nSee the timetable on the [When we play](/play) page, and get in touch if you would like to come along.",
    },
    {
      slug: "juniors",
      title: "Juniors",
      subtitle: "Table tennis for under-18s",
      nav_group: "play",
      body: "PLACEHOLDER — this page must be checked against the club's safeguarding policy before publishing.\n\nJunior coaching runs on Wednesday evenings for ages 8 to 17. Bats are provided. Beginners are genuinely welcome — most of the group started knowing nothing.\n\nAll our junior coaches are DBS-checked, and we have a named safeguarding officer. See [Who's who](/committee) for who to contact.",
    },
    {
      slug: "privacy",
      title: "Privacy notice",
      subtitle: "What we do with your details",
      nav_group: "hidden",
      body: "PLACEHOLDER — this notice must be reviewed by the committee before publishing.\n\n### What we hold\n\nIf you send us a message, we keep your name, email address and what you wrote, so that we can reply. If you join, we keep the details needed to register you with the league.\n\n### What we publish\n\nWe do not publish a member's email address or phone number anywhere on this website. A member appears on the site at all only if they have told us they are happy to.\n\n### Asking us to remove something\n\nWrite to us using the [contact form](/contact) and we will.",
    },
    {
      slug: "accessibility",
      title: "Accessibility statement",
      subtitle: "How this site is built, and what to do if it doesn't work for you",
      nav_group: "hidden",
      body: "This website is built to be usable by everyone, and particularly by our older members.\n\n### What we have done\n\n- Text starts at 20 pixels and every size on the site is set in a way that respects your browser and device text settings.\n- There is an **A / A+ / A++** control in the header if you would like the text larger still.\n- Text and background colours meet the strictest contrast standard (WCAG AAA) in both light and dark modes.\n- Nothing on the site opens on hover — everything works by click, tap or keyboard.\n- Buttons and links are at least 48 pixels across.\n- Wide tables become simple lists on a phone rather than scrolling sideways.\n- Every page can be read with JavaScript turned off.\n- Colour is never the only way we tell you something — a win, an away match or a cancelled session always says so in words.\n\n### If something doesn't work\n\nPlease [tell us](/contact). We would much rather know.",
    },
    {
      slug: "safeguarding",
      title: "Safeguarding",
      subtitle: "Keeping children and adults at risk safe",
      nav_group: "hidden",
      body: "PLACEHOLDER — this page must be written by the club's safeguarding officer, and must name a real person and a real contact route before publishing.\n\nThe club has a safeguarding policy and a named safeguarding officer. All coaches working with juniors are DBS-checked.\n\nIf you have a concern, contact the safeguarding officer directly — see [Who's who](/committee).",
    },
  ];

  for (const [index, seed] of pageSeeds.entries()) {
    await ensure(
      client,
      "hrc_pages",
      { slug: seed.slug },
      {
        title: seed.title,
        subtitle: seed.subtitle,
        body: seed.body,
        status: "published",
        nav_group: seed.nav_group,
        nav_sort: index,
        published_at: new Date().toISOString(),
      },
    );
  }

  // -- News and events -----------------------------------------------------

  const newsSeeds = [
    {
      slug: "welcome-to-the-new-website",
      title: "Welcome to the new club website",
      category: "news",
      summary: "Fixtures, results, tables and the timetable, all in one place — and it works on a phone.",
      body: "PLACEHOLDER article.\n\nThe club has a new website. Everything that used to take three clicks and a squint now has its own page: when we play, how to join, where our teams stand, and what happened last Thursday.\n\nIt is built to be readable — larger text, better contrast, and a text-size control in the corner if you want it bigger still. It works properly on a phone, which the old site never did.\n\nIf something is wrong, missing, or hard to read, please tell us.",
      pinned: true,
      author: "d-okafor",
    },
    {
      slug: "a-team-open-with-a-win",
      title: "A team open with a win over Water Lane",
      category: "match_report",
      summary: "A 7–3 win in the first match of the season, with three straight-sets rubbers.",
      body: "PLACEHOLDER match report.\n\nThe A team began the season with a comfortable 7–3 win over Water Lane A at home. Meera Chowdhury was unbeaten on the night, and Priya Mistry came through a five-setter that could have gone either way.\n\nNext up is Grundy Park B away.",
      author: "a-ashworth",
      fixtureRef: "26A01",
    },
    {
      slug: "junior-coaching-restarts",
      title: "Junior coaching restarts on Wednesday",
      category: "notice",
      summary: "Wednesdays, 5.30pm to 7pm. Beginners welcome, bats provided.",
      body: "PLACEHOLDER notice.\n\nJunior coaching restarts this Wednesday at 5.30pm. Ages 8 to 17, all abilities. Bats are provided — just bring flat shoes.\n\nThere is no need to book, but it helps us if you let us know you are coming.",
    },
    {
      slug: "newsletter-autumn-2026",
      title: "Newsletter — Autumn 2026",
      category: "newsletter",
      summary: "Season preview, the new committee, and a note about subscriptions.",
      body: "PLACEHOLDER newsletter.\n\nThis is where the newsletter text goes. When the club sends a newsletter as a PDF, attach the file to this item and it will appear as a download.",
    },
  ];

  for (const seed of newsSeeds) {
    await ensure(
      client,
      "hrc_news",
      { slug: seed.slug },
      {
        title: seed.title,
        summary: seed.summary,
        body: seed.body,
        category: seed.category,
        status: "published",
        is_pinned: seed.pinned ?? false,
        published_at: new Date().toISOString(),
        author: seed.author ? members[seed.author] : null,
        fixture: seed.fixtureRef ? fixtures[seed.fixtureRef] : null,
      },
    );
  }

  const eventSeeds = [
    {
      slug: "agm-2026",
      title: "Annual General Meeting",
      starts_at: "2026-11-19T19:30:00.000Z",
      description:
        "PLACEHOLDER.\n\nThe club's AGM. All members are welcome and encouraged to come — this is where the subscription is set, the committee is elected, and anything you want to raise gets raised.\n\nPapers will be circulated a fortnight beforehand and posted on the [documents page](/documents).",
      cost_note: "Free. Tea and biscuits provided.",
    },
    {
      slug: "club-championship-2027",
      title: "Club Championship",
      starts_at: "2027-03-14T13:00:00.000Z",
      description:
        "PLACEHOLDER.\n\nOur own championship, played across an afternoon. Singles, doubles and a handicap event, so everyone has a real chance in at least one of them.\n\nEntry sheet goes up in the hall in February.",
      cost_note: "£5 entry, whatever you enter.",
    },
  ];

  for (const seed of eventSeeds) {
    await ensure(
      client,
      "hrc_events",
      { slug: seed.slug },
      { ...seed, venue: venueId, status: "scheduled", is_members_only: false },
    );
  }

  // -- Club business -------------------------------------------------------

  const membershipSeeds = [
    { name: "Adult", price_pence: 6000, period: "season", includes: "Club nights, league registration and use of the hall.", sort: 1 },
    { name: "Junior (under 18)", price_pence: 3000, period: "season", includes: "Club nights and junior coaching.", sort: 2 },
    { name: "Student or unwaged", price_pence: 3000, period: "season", includes: "The same as adult membership.", sort: 3 },
    { name: "Visitor", price_pence: 600, period: "session", includes: "One club night, bat included. Your first is free.", sort: 4 },
  ];
  for (const seed of membershipSeeds) {
    const { name, ...rest } = seed;
    await ensure(client, "hrc_membership_options", { name }, { ...rest, is_active: true });
  }

  const committeeSeeds = [
    { role_title: "Chair", member: "a-ashworth", public_email: "chair@example.invalid", sort: 1, responsibilities: "Runs the committee and speaks for the club." },
    { role_title: "Secretary", member: "j-baptiste", public_email: "secretary@example.invalid", sort: 2, responsibilities: "Minutes, correspondence and the AGM." },
    { role_title: "Treasurer", member: "d-okafor", public_email: "treasurer@example.invalid", sort: 3, responsibilities: "Subscriptions, match fees and the accounts." },
    { role_title: "Match secretary", member: "r-whitfield", public_email: "matches@example.invalid", sort: 4, responsibilities: "Fixtures, registrations and dealing with the league." },
    { role_title: "Safeguarding officer", member: "c-devlin", public_email: "safeguarding@example.invalid", sort: 5, responsibilities: "The first person to speak to about any concern involving a child or an adult at risk." },
  ];
  for (const seed of committeeSeeds) {
    const { role_title, member, ...rest } = seed;
    await ensure(
      client,
      "hrc_committee_roles",
      { role_title },
      { ...rest, member: members[member], is_active: true },
    );
  }

  const linkSeeds = [
    { label: "Hertford & District Table Tennis League", url: "https://hertsttl.org.uk", category: "Our league", description: "Fixtures, results, tables and averages for every club in the league.", sort: 1 },
    { label: "Table Tennis England", url: "https://tabletennisengland.co.uk", category: "The sport", description: "The national governing body — rules, coaching and player registration.", sort: 2 },
    { label: "Find a club near you", url: "https://www.tabletennisengland.co.uk/leagues-and-clubs/", category: "The sport", description: "Table Tennis England's club finder, if we are not the right club for you.", sort: 3 },
  ];
  for (const seed of linkSeeds) {
    const { label, ...rest } = seed;
    await ensure(client, "hrc_links", { label }, { ...rest, is_active: true });
  }

  const faqSeeds = [
    { question: "Can I just turn up?", answer: "Yes. Come to a club night, tell whoever is on the door that it is your first time, and they will sort you out with a bat and someone to play. Your first evening is free.", sort: 1 },
    { question: "I have never played before. Will I be out of my depth?", answer: "No. We have members who joined having never held a bat, and members who have played for forty years, and they play on adjacent tables. Tell us it is your first time and we will make sure you are playing with someone at your level.", sort: 2 },
    { question: "What should I wear?", answer: "Something you can move in, and clean flat-soled indoor shoes. That is genuinely all.", sort: 3 },
    { question: "Do I need my own bat?", answer: "Not to start with — we will lend you one. Most people buy their own after a few weeks, and we can tell you what to look for without you spending a fortune.", sort: 4 },
    { question: "How do I get into a team?", answer: "Come to club nights for a few weeks, and talk to a captain — they are listed on each team's page. Teams are picked on availability as much as standard, so being reliable matters more than being brilliant.", sort: 5 },
    { question: "How much does it cost?", answer: "See the [Join us](/join) page for the current fees. There is a session rate if you would rather not commit to a season.", sort: 6 },
    { question: "Where do I park?", answer: "There is free parking on site. It fills up on match nights, so allow a few extra minutes. Full details are on the [venue page](/play).", sort: 7 },
  ];
  for (const seed of faqSeeds) {
    const { question, ...rest } = seed;
    await ensure(client, "hrc_faqs", { question }, { ...rest, is_published: true });
  }

  // -- Honours -------------------------------------------------------------

  const honourSeeds = [
    { title: "Division 1 champions", season_label: "2025-26", honour_type: "team", competition: "league", notes: "Promoted to the Premier Division." },
    { title: "Creasey Cup winners", season_label: "2024-25", honour_type: "team", competition: "creasey_cup", notes: "Beat Water Lane A in the final." },
    { title: "Division 2 champions", season_label: "2019-20", honour_type: "team", competition: "league", notes: "" },
    { title: "MSD Trophy winners", season_label: "2014-15", honour_type: "team", competition: "msd_trophy", notes: "" },
    { title: "Division 1 champions", season_label: "1998-99", honour_type: "team", competition: "league", notes: "PLACEHOLDER — verify against club records." },
  ];
  for (const seed of honourSeeds) {
    const { title, season_label, ...rest } = seed;
    await ensure(
      client,
      "hrc_honours",
      { title, season_label },
      { ...rest, season: season_label === PREVIOUS_SEASON ? previousSeasonId : null },
    );
  }

  // -- Site settings -------------------------------------------------------

  // Guarded on `strapline` rather than `club_name`: club_name carries a
  // column default, so it is non-empty on a brand-new instance and would
  // make this look already-seeded on the very first run.
  const settings = (await client.request(readSingleton("hrc_site_settings" as never))) as Row;
  if (!settings?.strapline) {
    await client.request(
      updateSingleton("hrc_site_settings" as never, {
        club_name: "HRC Table Tennis Club",
        short_name: "HRC",
        strapline: "Table tennis in Hertford — all ages, all standards",
        founded_year: 1975,
        about_summary:
          "PLACEHOLDER — replace with the club's own words.\n\nWe run club nights, coaching for adults and juniors, and three teams in the Hertford & District Table Tennis League. New members are welcome whatever your standard, and your first evening is free.",
        contact_email: "hello@example.invalid",
        league_url: "https://hertsttl.org.uk",
        current_season: seasonId,
      } as never),
    );
    created += 1;
    console.log("  + site settings");
  } else {
    skipped += 1;
  }

  console.log(`\nSeed complete — ${created} rows created, ${skipped} already existed.`);
  console.log(
    "Everything above is placeholder content. Replace it in the Directus admin panel before the site goes anywhere near the public.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
