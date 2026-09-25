import { createItems, deleteItems, readItems, updateItem } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import {
  DOUBLES_RUBBER,
  hasBlockingError,
  matchScoreOf,
  outcomeOf,
  reviewScorecard,
  rubberRowsFor,
  type ResolvedRubber,
} from "../../../shared/scorecard.js";
import { parseMatchHistory, type MatchRow } from "./parse-match-history.js";
import { parseScorecardPage, type LeagueScorecard } from "./parse-scorecard-page.js";

/**
 * Imports the league's posted scorecards for every match already played.
 *
 * The fixture import brings the result — HRC A 5, Ellenborough A 5 — and
 * nothing behind it. The card is where the players are: who played at A,
 * B and C, every game of every match, the doubles pair. Without it a
 * player's page has nothing on it and the averages have nothing to count.
 * The league publishes each card at `ScoreCard.asp?LMID=…`, linked from
 * the magnifying glass on a team's match history, and this reads them.
 *
 *   npm run directus:import:scorecards              # import
 *   npm run directus:import:scorecards -- --dry-run # check everything, write nothing
 *
 * **Nothing is written that has not proved itself.** A card is refused,
 * with the reason, if any of these fail:
 *
 *   - the parser found something it could not reconcile;
 *   - the card is for different teams than the fixture;
 *   - the checks a card entered on this site gets (`reviewScorecard`)
 *     find a blocking error;
 *   - the games do not add up to the card's own printed final result, or
 *     any match's games give a different winner from its Sets column;
 *   - the card's result disagrees with the result the fixture holds.
 *
 * **A name becomes a member only on an exact match**, first in the team's
 * own squad and then anywhere in the same club — a player "playing up"
 * from a lower team is in the club's C squad, not the B's, and is exactly
 * who the card means. Anything short of exact is kept as the name, which
 * the match page shows unlinked, and listed at the end. A near-miss
 * guessed into the wrong member credits their matches to somebody else
 * and surfaces months later in an averages table nobody can explain.
 *
 * **A card entered on this site is never overwritten** by the league's
 * copy. A card this script imported before is replaced, so a correction
 * posted on the league's site comes through on the next run.
 */

const BASE = "http://hertsttl.org.uk";

type Row = Record<string, any>;

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  // Windows-1252, like the rest of that site; read as UTF-8 the players'
  // names come back subtly wrong and then match nobody.
  return new TextDecoder("windows-1252").decode(await response.arrayBuffer());
}

function isLeagueUrl(url: unknown): boolean {
  return typeof url === "string" && url.startsWith(BASE);
}

/** How a name on the card was matched, so the report can say how sure to be. */
type How = "team" | "club" | "ambiguous" | "unmatched";

interface Resolved {
  id: string | null;
  how: How;
  /** Where a player was found in another of the club's teams — playing up or down. */
  from?: string;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const client = await getSchemaClient();

  console.log(
    `Importing scorecards from ${BASE}${dryRun ? " — dry run, nothing will be written" : ""}\n`,
  );

  const season = (
    (await client.request(
      readItems("hrc_seasons" as never, {
        fields: ["id", "label"],
        filter: { is_current: { _eq: true } },
        limit: 1,
      } as never),
    )) as Row[]
  )[0];
  if (!season) throw new Error("No current season.");

  // -- Who is registered where ----------------------------------------------

  const squads = (await client.request(
    readItems("hrc_squads" as never, {
      fields: [
        { member: ["id", "full_name"] },
        { team: ["id", "name", { club: ["id"] }] },
      ],
      filter: { season: { _eq: season.id } },
      limit: -1,
    } as never),
  )) as Row[];

  const byTeam = new Map<string, Map<string, Set<string>>>();
  const byClub = new Map<string, Map<string, Array<{ id: string; team: string }>>>();
  for (const place of squads) {
    const name = (place.member?.full_name as string | undefined)?.trim();
    const memberId = place.member?.id as string | undefined;
    const team = place.team?.name as string | undefined;
    const club = place.team?.club?.id as string | undefined;
    if (!name || !memberId || !team || !club) continue;

    const teamNames = byTeam.get(team) ?? new Map<string, Set<string>>();
    teamNames.set(name, (teamNames.get(name) ?? new Set()).add(memberId));
    byTeam.set(team, teamNames);

    const clubNames = byClub.get(club) ?? new Map<string, Array<{ id: string; team: string }>>();
    clubNames.set(name, [...(clubNames.get(name) ?? []), { id: memberId, team }]);
    byClub.set(club, clubNames);
  }

  function resolve(name: string | null, team: string, club: string): Resolved {
    if (!name) return { id: null, how: "unmatched" };
    const inTeam = byTeam.get(team)?.get(name);
    if (inTeam?.size === 1) return { id: [...inTeam][0]!, how: "team" };
    if (inTeam && inTeam.size > 1) return { id: null, how: "ambiguous" };

    const inClub = [...new Map((byClub.get(club)?.get(name) ?? []).map((m) => [m.id, m])).values()];
    if (inClub.length === 1) return { id: inClub[0]!.id, how: "club", from: inClub[0]!.team };
    if (inClub.length > 1) return { id: null, how: "ambiguous" };
    return { id: null, how: "unmatched" };
  }

  // -- The matches with a result ---------------------------------------------

  const fixtures = (await client.request(
    readItems("hrc_fixtures" as never, {
      fields: [
        "id",
        "week_commencing",
        "played_on",
        "home_score",
        "away_score",
        "scorecard_url",
        { home_team: ["name", { club: ["id"] }] },
        { away_team: ["name", { club: ["id"] }] },
      ],
      filter: {
        _and: [
          { season: { _eq: season.id } },
          { competition: { _eq: "league" } },
          { status: { _eq: "played" } },
        ],
      },
      sort: ["week_commencing"],
      limit: -1,
    } as never),
  )) as Row[];

  const withCards = new Set(
    fixtures.length === 0
      ? []
      : (
          (await client.request(
            readItems("hrc_rubbers" as never, {
              fields: ["fixture"],
              filter: { fixture: { _in: fixtures.map((f) => f.id) } },
              limit: -1,
            } as never),
          )) as Row[]
        ).map((row) => String(row.fixture)),
  );

  console.log(`  ${fixtures.length} played match(es) in ${season.label}\n`);

  // One match history page per team, read at most once.
  const histories = new Map<string, MatchRow[]>();
  async function historyOf(team: string): Promise<MatchRow[]> {
    if (!histories.has(team)) {
      const page = await fetchPage(`${BASE}/MatchHistory.asp?Team=${encodeURIComponent(team)}`);
      histories.set(team, parseMatchHistory(page));
    }
    return histories.get(team)!;
  }

  const outcome = {
    imported: [] as string[],
    reimported: [] as string[],
    skipped: [] as string[],
    refused: [] as string[],
  };
  const names = { team: 0, club: [] as string[], unresolved: [] as string[] };

  for (const fixture of fixtures) {
    const home = fixture.home_team?.name as string;
    const away = fixture.away_team?.name as string;
    const label = `${home} ${fixture.home_score}–${fixture.away_score} ${away}`;

    if (withCards.has(String(fixture.id)) && !isLeagueUrl(fixture.scorecard_url)) {
      outcome.skipped.push(`${label} — card entered on this site; not overwritten`);
      continue;
    }

    // -- Find the card --------------------------------------------------------
    let path: string | null = null;
    for (const team of [home, away]) {
      const row = (await historyOf(team)).find(
        (match) =>
          match.weekCommencing === fixture.week_commencing &&
          match.homeTeam === home &&
          match.awayTeam === away,
      );
      if (row?.scorecardPath) {
        path = row.scorecardPath;
        break;
      }
    }
    if (!path) {
      // A result with no card behind it yet — the match secretary can enter
      // the score before the card. Not an error; next run picks it up.
      outcome.skipped.push(`${label} — no card posted on the league's site yet`);
      continue;
    }

    const url = new URL(path, `${BASE}/`).toString();
    let parsed: LeagueScorecard;
    try {
      parsed = parseScorecardPage(await fetchPage(url));
    } catch (error) {
      outcome.refused.push(`${label} — could not read ${url}: ${(error as Error).message}`);
      continue;
    }
    const card = parsed.card;

    // -- Prove it before writing it --------------------------------------------
    const reasons: string[] = [...parsed.problems];
    if (card.homeTeamName !== home || card.awayTeamName !== away) {
      reasons.push(`the card is for ${card.homeTeamName} v ${card.awayTeamName}`);
    }
    const warnings = reviewScorecard(card);
    if (hasBlockingError(warnings)) {
      reasons.push(...warnings.filter((w) => w.severity === "error").map((w) => w.message));
    }
    const derived = matchScoreOf(card.rubbers);
    if (!parsed.finalResult || parsed.finalResult[0] !== derived.home || parsed.finalResult[1] !== derived.away) {
      reasons.push(
        `the games add up to ${derived.home}–${derived.away} but the card prints ${parsed.finalResult?.join("–") ?? "no result"}`,
      );
    }
    card.rubbers.forEach((rubber, index) => {
      const printed = parsed.matchResults[index];
      const { homeSets, awaySets } = outcomeOf(rubber.games);
      if (!printed || homeSets > awaySets !== printed[0] > printed[1]) {
        reasons.push(`match ${rubber.rubberNumber}'s games give a different winner from its Sets column`);
      }
    });
    if (derived.home !== fixture.home_score || derived.away !== fixture.away_score) {
      reasons.push(
        `the card says ${derived.home}–${derived.away}; the result held here is ${fixture.home_score}–${fixture.away_score}`,
      );
    }
    if (reasons.length > 0) {
      outcome.refused.push(`${label} — ${reasons.join("; ")}`);
      continue;
    }

    // -- Names to members ------------------------------------------------------
    const homeClub = fixture.home_team?.club?.id as string;
    const awayClub = fixture.away_team?.club?.id as string;
    const seen = new Map<string, Resolved>();
    const who = (name: string | null, side: "home" | "away"): Resolved => {
      const key = `${side}|${name}`;
      if (!seen.has(key)) {
        const found = resolve(name, side === "home" ? home : away, side === "home" ? homeClub : awayClub);
        seen.set(key, found);
        const team = side === "home" ? home : away;
        if (found.how === "team") names.team += 1;
        else if (found.how === "club") names.club.push(`${name} (${team}, registered with ${found.from})`);
        else if (name) names.unresolved.push(`${name} (${team}) — ${found.how}`);
      }
      return seen.get(key)!;
    };

    const rubbers: ResolvedRubber[] = card.rubbers.map((rubber) => {
      const doubles = rubber.rubberNumber === DOUBLES_RUBBER;
      return {
        rubberNumber: rubber.rubberNumber,
        kind: doubles ? "doubles" : "singles",
        homePlayerId: who(rubber.homePlayer, "home").id,
        homePlayer2Id: doubles ? who(rubber.homePlayer2, "home").id : null,
        awayPlayerId: who(rubber.awayPlayer, "away").id,
        awayPlayer2Id: doubles ? who(rubber.awayPlayer2, "away").id : null,
        homePlayerName: rubber.homePlayer,
        homePlayer2Name: rubber.homePlayer2,
        awayPlayerName: rubber.awayPlayer,
        awayPlayer2Name: rubber.awayPlayer2,
        games: rubber.games,
      };
    });

    const note = `${label} — card posted ${parsed.postedAt} by ${parsed.postedBy}, played ${card.playedOn}`;
    if (dryRun) {
      outcome.imported.push(note);
      continue;
    }

    // -- Write it, the way a card saved on this site is written ----------------
    const existing = (await client.request(
      readItems("hrc_rubbers" as never, {
        fields: ["id"],
        filter: { fixture: { _eq: fixture.id } },
        limit: -1,
      } as never),
    )) as Row[];
    if (existing.length > 0) {
      await client.request(deleteItems("hrc_rubbers" as never, existing.map((row) => row.id) as never));
    }
    await client.request(createItems("hrc_rubbers" as never, rubberRowsFor(fixture.id, rubbers) as never));
    await client.request(
      updateItem("hrc_fixtures" as never, fixture.id, {
        status: "played",
        home_score: derived.home,
        away_score: derived.away,
        // The card's date is the night it was actually played — which for
        // a rearranged match is not the night the calendar scheduled.
        ...(card.playedOn ? { played_on: card.playedOn } : {}),
        scorecard_url: url,
        last_synced_at: new Date().toISOString(),
      } as never),
    );
    (existing.length > 0 ? outcome.reimported : outcome.imported).push(
      existing.length > 0 ? `${note} (replaced the earlier import)` : note,
    );
  }

  // -- Report ------------------------------------------------------------------
  const section = (title: string, lines: string[]) => {
    if (lines.length === 0) return;
    console.log(`  ${title} (${lines.length})`);
    for (const line of lines) console.log(`      ${line}`);
    console.log("");
  };
  section(dryRun ? "would import" : "imported", outcome.imported);
  section("re-imported", outcome.reimported);
  section("skipped", outcome.skipped);
  section("REFUSED — nothing written for these", outcome.refused);

  const appearances = names.team + names.club.length + names.unresolved.length;
  console.log(`  players: ${appearances} distinct on the cards`);
  console.log(`      ${names.team} matched in their own team's squad`);
  if (names.club.length > 0) {
    console.log(`      ${names.club.length} matched elsewhere in their club — playing up or down:`);
    for (const line of names.club) console.log(`          ${line}`);
  }
  if (names.unresolved.length > 0) {
    console.log(`      ${names.unresolved.length} kept as a name only — no exact match in the club:`);
    for (const line of names.unresolved) console.log(`          ${line}`);
  }

  if (outcome.refused.length > 0) process.exitCode = 1;
  console.log(`\nScorecard import ${dryRun ? "dry run " : ""}complete.`);
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
