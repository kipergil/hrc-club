import { createItems, deleteItems, readItems, updateItem } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";

/**
 * Fills in sample results for one team, so the pages that only exist to
 * show results can be looked at before a single card has been entered.
 *
 * **This writes invented data to the live database.** Nothing here is a
 * real score. It exists because `/results`, `/tables`, `/teams/:slug` and
 * a match's own page are all built, tested and completely empty until the
 * season starts, and a design that has never been seen carrying data is a
 * design nobody has actually reviewed.
 *
 *   npm run directus:sample:results            # fill them in
 *   npm run directus:sample:results -- --clear # take them all out again
 *
 * `--clear` is exact rather than approximate: it deletes the rubbers it
 * created and returns the fixtures to `scheduled` with null scores, which
 * is precisely the state they were in beforehand. Run it before the real
 * season starts, or the first real result will land in a table that
 * already has fiction in it.
 *
 * The format is the league's own: three players a side, nine singles and
 * a doubles, ten rubbers in all, and a team's points are the rubbers it
 * won. That is what makes the derived league table add up.
 */

const TEAM = "HRC B";

/** How many of the team's fourteen fixtures to fill in. */
const MATCHES = 6;

/**
 * The results, written out rather than randomised.
 *
 * A seeded random generator would be shorter and would produce a season
 * that is all much of a muchness. These are chosen to exercise the things
 * the pages actually have to render: a comfortable win, a narrow win, a
 * heavy defeat, and — the one every league table's tie-break code cares
 * about and no random run reliably produces — a **5–5 draw**.
 *
 * `for` is HRC B's rubbers, whichever side of the fixture they are on;
 * the importer works out home and away from the fixture itself.
 */
const RESULTS: Array<{ for: number; against: number }> = [
  { for: 3, against: 7 }, // away at Water Lane A — beaten by the champions
  { for: 8, against: 2 }, // home to Grundy Park A
  { for: 4, against: 6 }, // away at HRC A — the club derby
  { for: 7, against: 3 }, // home to Cheshunt A
  { for: 5, against: 5 }, // away at Ellenborough A — a draw
  { for: 6, against: 4 }, // away at Kidston
];

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

/**
 * Set scores for one rubber, consistent with who won it.
 *
 * Best of five, 11 up. The detail matters only because the card prints
 * it, and a scoreline of "3-1" beside "11-8, 11-6" would be visibly wrong
 * to anyone who plays.
 */
function setScores(won: boolean, index: number): { setsFor: number; setsAgainst: number; detail: string } {
  // Three shapes, rotated, so a card is not ten identical 3-0s.
  const shape = index % 3;
  const games =
    shape === 0
      ? ["11-8", "11-6", "11-9"]
      : shape === 1
        ? ["11-7", "9-11", "11-8", "11-5"]
        : ["8-11", "11-9", "11-7", "9-11", "11-8"];
  const setsWon = 3;
  const setsLost = games.filter((game) => {
    const [a, b] = game.split("-").map(Number);
    return (a ?? 0) < (b ?? 0);
  }).length;

  // Written from the winner's side, then flipped for the loser so the
  // detail always reads left-to-right as the row's own player.
  const flip = (game: string) => game.split("-").reverse().join("-");
  return won
    ? { setsFor: setsWon, setsAgainst: setsLost, detail: games.join(", ") }
    : { setsFor: setsLost, setsAgainst: setsWon, detail: games.map(flip).join(", ") };
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
        "played_on",
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
    const ids = fixtures.map((fixture) => fixture.id as string);
    const removed = await clearRubbers(client, ids);
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

  // Anything left over from a previous run, so re-running does not stack
  // twenty rubbers onto a ten-rubber match.
  await clearRubbers(client, fixtures.map((fixture) => fixture.id as string));

  let written = 0;

  for (const [index, result] of RESULTS.slice(0, MATCHES).entries()) {
    const fixture = fixtures[index];
    if (!fixture) break;

    const isHome = rel(fixture.home_team)?.name === TEAM;
    const opponentName = (isHome ? rel(fixture.away_team) : rel(fixture.home_team))?.name as string;
    const opponents = OPPONENTS[opponentName] ?? GENERIC;

    /*
     * Which of the ten rubbers this team won. Deterministic rather than
     * random so a re-run produces the same season, and spread across the
     * card rather than front-loaded so no match reads as nine straight
     * wins then nothing.
     */
    const wins = new Set<number>();
    for (let n = 0; wins.size < result.for; n += 1) {
      wins.add((n * 3 + 1) % 10);
    }

    const rubbers: Row[] = [];
    for (let n = 0; n < 10; n += 1) {
      const isDoubles = n === 9;
      const won = wins.has(n);
      const { setsFor, setsAgainst, detail } = setScores(won, n);

      rubbers.push({
        fixture: fixture.id,
        rubber_number: n + 1,
        // Nine singles: each of the three plays each of the three.
        member: isDoubles ? null : players[n % 3]!.member.id,
        player_name: isDoubles
          ? `${players[0]!.member.full_name} & ${players[1]!.member.full_name}`
          : null,
        opponent_player_name: isDoubles
          ? `${opponents[0]} & ${opponents[1]}`
          : opponents[Math.floor(n / 3)],
        is_home_player: isHome,
        sets_for: setsFor,
        sets_against: setsAgainst,
        won,
        score_detail: detail,
      });
    }

    await client.request(createItems("hrc_rubbers" as never, rubbers as never));

    // The match is played on the Wednesday of its week — HRC's home night,
    // and near enough for a sample.
    const week = new Date(`${fixture.week_commencing}T00:00:00Z`);
    week.setUTCDate(week.getUTCDate() + 2);

    await client.request(
      updateItem("hrc_fixtures" as never, fixture.id, {
        status: "played",
        played_on: week.toISOString().slice(0, 10),
        home_score: isHome ? result.for : result.against,
        away_score: isHome ? result.against : result.for,
      } as never),
    );

    written += 1;
    console.log(
      `  = ${fixture.week_commencing} ${isHome ? "v" : "at"} ${opponentName}: ` +
        `${result.for}-${result.against} (${result.for > result.against ? "won" : result.for < result.against ? "lost" : "drawn"})`,
    );
  }

  const won = RESULTS.slice(0, MATCHES).filter((r) => r.for > r.against).length;
  const drawn = RESULTS.slice(0, MATCHES).filter((r) => r.for === r.against).length;
  const points = RESULTS.slice(0, MATCHES).reduce((total, r) => total + r.for, 0);

  console.log(
    `\n  ${written} matches, ${written * 10} rubbers. ` +
      `${TEAM}: ${won} won, ${drawn} drawn, ${written - won - drawn} lost, ${points} points.`,
  );
  console.log("\n  Remove it all with: npm run directus:sample:results -- --clear");
}

function rel(value: unknown): Row | null {
  return value && typeof value === "object" ? (value as Row) : null;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
