import { createItems, deleteItems, readItems, updateItem } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import {
  DOUBLES_RUBBER,
  RUBBERS_PER_MATCH,
  SINGLES_ORDER,
  matchScoreOf,
  outcomeOf,
} from "../../../shared/scorecard.js";

/**
 * Fills in sample results for one team, so the pages that only exist to
 * show results can be looked at carrying data.
 *
 * **This writes invented data to the live database.** Nothing here is a
 * real score.
 *
 *   npm run directus:sample:results            # fill them in
 *   npm run directus:sample:results -- --clear # take them all out again
 *
 * `--clear` is exact rather than approximate: it deletes the rubbers it
 * created and returns the fixtures to `scheduled` with null scores, which
 * is the state they were in beforehand. Run it before the real season
 * starts, or the first real result will land in a table that already has
 * fiction in it.
 *
 * Cards follow the league's own sheet: three players a side, nine singles
 * in the printed order, then the doubles. The match score is *derived*
 * from the games rather than set alongside them, which is the same path a
 * real card takes through `shared/scorecard.ts` — so if that arithmetic
 * were wrong, this sample would be visibly wrong too.
 */

const TEAM = "HRC B";

/** How many of the team's fourteen fixtures to fill in. */
const MATCHES = 6;

/**
 * How each match should come out, as rubbers won by HRC B.
 *
 * Written out rather than randomised, to exercise what the pages have to
 * render: a comfortable win, a narrow one, a heavy defeat, and a 5-5
 * draw — the case every league table's tie-break cares about and no
 * random run reliably produces.
 */
const RESULTS = [3, 8, 4, 7, 5, 6];

/** Opposition names, so a card is not nine blanks. Invented, like the scores. */
const OPPONENTS: Record<string, string[]> = {
  "Water Lane A": ["Shaun Gardner", "Daniel Gillett", "Elliott Lugg"],
  "Grundy Park A": ["Paul Jones", "John Manley", "Peter Buzzard"],
  "HRC A": ["Derek Balding", "Andy Nash", "Chris Wade"],
  "Cheshunt A": ["Albert Francis", "Gary Thurston", "Reuben Okai"],
  "Ellenborough A": ["Clint Armstrong", "Sandy Nash", "Richard Grethe"],
  Kidston: ["Arrow Lam", "Louise Johnston", "Bradley Tuttle"],
};

const GENERIC = ["A. Berry", "C. Doyle", "E. Fisher"];

type Row = Record<string, any>;
type Client = Awaited<ReturnType<typeof getSchemaClient>>;
type Game = [number, number];

function rel(value: unknown): Row | null {
  return value && typeof value === "object" ? (value as Row) : null;
}

/**
 * A plausible best-of-five, from the point of view of the side that won.
 *
 * Rotated through three shapes so a card is not ten identical 3-0s, and
 * every game is a legal one — 11 up, two clear — because
 * `checkScorecard` would otherwise flag this sample as unreadable.
 */
function gamesFor(homeWins: boolean, index: number): Game[] {
  const shape = index % 3;
  const winnerFirst: Game[] =
    shape === 0
      ? [[11, 8], [11, 6], [11, 9]]
      : shape === 1
        ? [[11, 7], [9, 11], [11, 8], [11, 5]]
        : [[8, 11], [11, 9], [11, 7], [9, 11], [12, 10]];

  return homeWins ? winnerFirst : winnerFirst.map(([a, b]) => [b, a] as Game);
}

async function squadOf(client: Client, teamName: string): Promise<Row[]> {
  const rows = (await client.request(
    readItems("hrc_squads" as never, {
      fields: ["id", "role", "member.id", "member.full_name"],
      filter: { team: { name: { _eq: teamName } } },
      limit: -1,
    } as never),
  )) as Row[];
  return rows.filter((row) => row.member);
}

async function fixturesOf(client: Client, teamName: string): Promise<Row[]> {
  return (await client.request(
    readItems("hrc_fixtures" as never, {
      fields: [
        "id",
        "week_commencing",
        "status",
        "home_team.id",
        "home_team.name",
        "away_team.id",
        "away_team.name",
      ],
      filter: {
        _or: [{ home_team: { name: { _eq: teamName } } }, { away_team: { name: { _eq: teamName } } }],
      },
      sort: ["week_commencing"],
      limit: -1,
    } as never),
  )) as Row[];
}

async function clearRubbers(client: Client, fixtureIds: string[]): Promise<number> {
  if (fixtureIds.length === 0) return 0;
  const rows = (await client.request(
    readItems("hrc_rubbers" as never, {
      fields: ["id"],
      filter: { fixture: { _in: fixtureIds } },
      limit: -1,
    } as never),
  )) as Row[];
  if (rows.length > 0) {
    await client.request(deleteItems("hrc_rubbers" as never, rows.map((row) => row.id)));
  }
  return rows.length;
}

async function main(): Promise<void> {
  const clear = process.argv.includes("--clear");
  const client = await getSchemaClient();

  const fixtures = await fixturesOf(client, TEAM);
  if (fixtures.length === 0) {
    throw new Error(`No fixtures found for ${TEAM}. Run \`npm run import:fixtures\` first.`);
  }

  if (clear) {
    console.log(`Removing the sample results for ${TEAM}\n`);
    const removed = await clearRubbers(client, fixtures.map((fixture) => fixture.id as string));
    for (const fixture of fixtures) {
      await client.request(
        updateItem("hrc_fixtures" as never, fixture.id, {
          status: "scheduled",
          home_score: null,
          away_score: null,
          played_on: null,
        } as never),
      );
    }
    console.log(`  = ${fixtures.length} fixtures back to scheduled, ${removed} rubbers deleted.`);
    return;
  }

  console.log(`Writing sample results for ${TEAM} — invented data, not real scores\n`);

  const squad = await squadOf(client, TEAM);
  if (squad.length < 3) {
    throw new Error(`${TEAM} has ${squad.length} registered players; a card needs three.`);
  }
  const players = squad.slice(0, 3);

  await clearRubbers(client, fixtures.map((fixture) => fixture.id as string));

  let written = 0;
  const tally = { won: 0, drawn: 0, lost: 0, points: 0 };

  for (const [index, teamRubbers] of RESULTS.slice(0, MATCHES).entries()) {
    const fixture = fixtures[index];
    if (!fixture) break;

    const isHome = rel(fixture.home_team)?.name === TEAM;
    const opponentName = (isHome ? rel(fixture.away_team) : rel(fixture.home_team))?.name as string;
    const opponents = OPPONENTS[opponentName] ?? GENERIC;

    // Which rubbers this team wins. Spread across the card rather than
    // front-loaded, so no match reads as a run of wins then nothing.
    const wins = new Set<number>();
    for (let n = 0; wins.size < teamRubbers; n += 1) wins.add((n * 3 + 1) % RUBBERS_PER_MATCH);

    const rows: Row[] = [];
    for (let n = 0; n < RUBBERS_PER_MATCH; n += 1) {
      const number = n + 1;
      const isDoubles = number === DOUBLES_RUBBER;
      const teamWins = wins.has(n);
      // The card is written home-first; the team we are filling in may be
      // either side, so translate once here.
      const games = gamesFor(isHome ? teamWins : !teamWins, n);
      const { homeSets, awaySets } = outcomeOf(games);

      const slots = SINGLES_ORDER[n];
      const teamPlayer = isDoubles ? players[0]! : players["ABC".indexOf(slots![0])]!;
      const teamPartner = isDoubles ? players[1]! : null;
      const oppIndex = isDoubles ? 0 : "XYZ".indexOf(slots![1]);
      const oppPlayer = opponents[oppIndex] ?? opponents[0]!;
      const oppPartner = isDoubles ? (opponents[1] ?? null) : null;

      rows.push({
        fixture: fixture.id,
        rubber_number: number,
        kind: isDoubles ? "doubles" : "singles",
        // Our players are members; the opposition are names on a card,
        // because this site does not hold other clubs' squads as players.
        home_player: isHome ? teamPlayer.member.id : null,
        home_player_2: isHome ? teamPartner?.member.id ?? null : null,
        home_player_name: isHome ? null : oppPlayer,
        away_player: isHome ? null : teamPlayer.member.id,
        away_player_2: isHome ? null : teamPartner?.member.id ?? null,
        away_player_name: isHome ? oppPlayer : null,
        home_sets: homeSets,
        away_sets: awaySets,
        games,
      });

      // The doubles pair's second name, on whichever side is the opposition.
      if (isDoubles && oppPartner) {
        const row = rows[rows.length - 1]!;
        if (isHome) row.away_player_name = `${oppPlayer} & ${oppPartner}`;
        else row.home_player_name = `${oppPlayer} & ${oppPartner}`;
      }
    }

    await client.request(createItems("hrc_rubbers" as never, rows as never));

    // Derived from the games, exactly as a real card is.
    const score = matchScoreOf(rows.map((row) => ({ games: row.games as Game[] })));

    const week = new Date(`${fixture.week_commencing}T00:00:00Z`);
    week.setUTCDate(week.getUTCDate() + 2); // HRC play on Wednesdays.

    await client.request(
      updateItem("hrc_fixtures" as never, fixture.id, {
        status: "played",
        played_on: week.toISOString().slice(0, 10),
        home_score: score.home,
        away_score: score.away,
      } as never),
    );

    const ours = isHome ? score.home : score.away;
    const theirs = isHome ? score.away : score.home;
    if (ours > theirs) tally.won += 1;
    else if (ours < theirs) tally.lost += 1;
    else tally.drawn += 1;
    tally.points += ours;

    written += 1;
    console.log(
      `  = ${fixture.week_commencing} ${isHome ? "v" : "at"} ${opponentName}: ${ours}-${theirs}`,
    );
  }

  console.log(
    `\n  ${written} matches, ${written * RUBBERS_PER_MATCH} rubbers. ` +
      `${TEAM}: ${tally.won} won, ${tally.drawn} drawn, ${tally.lost} lost, ${tally.points} points.`,
  );
  console.log("\n  Remove it all with: npm run directus:sample:results -- --clear");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
