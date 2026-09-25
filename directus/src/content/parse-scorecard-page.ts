import {
  DOUBLES_RUBBER,
  SINGLES_ORDER,
  type Game,
  type ScorecardInput,
} from "../../../shared/scorecard.js";

/**
 * Parser for the league's posted scorecard, `ScoreCard.asp?LMID=…`.
 *
 * This is the card as a captain or the match secretary entered it into the
 * league's own system: the six players against their letters, every game
 * of every match, the doubles pair by letter, the final result, and who
 * posted it when. It is what the magnifying glass on a team's match history
 * opens.
 *
 * It comes out as `ScorecardInput` — the same shape a photographed or
 * typed-in card takes on its way to being saved here — so an imported card
 * goes through exactly the checks a card entered on this site does. The
 * extras (the league's own final result, its per-match Sets column, who
 * posted it) travel alongside for the importer to cross-check against.
 *
 * Pure and tested against captured copies. Like the other parsers in this
 * directory, the failure that costs most is not an exception but a card
 * that parses cleanly and is wrong, so the parser reports what it could
 * not make sense of rather than guessing.
 */

export interface LeagueScorecard {
  card: ScorecardInput;
  /** As the card prints it: "Premier", "One", "Two". */
  division: string | null;
  /** The card's own "Final Result (in sets)", home first. */
  finalResult: [number, number] | null;
  /**
   * The card's own Sets column for each match, in card order — `[1, 0]`
   * for a home win. Kept so the importer can check that the games it read
   * produce the same winner the league recorded.
   */
  matchResults: Array<[number, number] | null>;
  postedBy: string | null;
  /** "24 Sep 2026 at 11:04", as printed. */
  postedAt: string | null;
  /** Anything structural the parser could not reconcile. Empty on a clean card. */
  problems: string[];
}

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

/** "10 - 12" → [10, 12]. Anything else — including an unplayed game's image — is null. */
function pair(cell: string): [number, number] | null {
  const match = text(cell).match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function cellsOf(row: string): string[] {
  return [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]!);
}

/** "23/09/2026" → "2026-09-23". */
function isoDate(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseScorecardPage(source: string): LeagueScorecard {
  const html = source.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const problems: string[] = [];

  const date = html.match(/Date:[\s\S]*?(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  const division = html.match(/Division:[\s\S]*?<font[^>]*>([^<]*)<\/font>/i);
  const teams = html.match(/Home Team[\s\S]*?<b>([^<]+)<\/b>[\s\S]*?<b>([^<]+)<\/b>[\s\S]*?Away Team/i);
  const final = html.match(/Final Result[\s\S]*?<b>([\s\S]*?)<\/b>/i);
  const posted = html.match(/Posted\s+([\s\S]+?)\s+by\s+([\s\S]+?)\s*<\/i>/i);

  const homePlayers: ScorecardInput["homePlayers"] = { A: null, B: null, C: null };
  const awayPlayers: ScorecardInput["awayPlayers"] = { X: null, Y: null, Z: null };
  const rubbers: ScorecardInput["rubbers"] = [];
  const matchResults: LeagueScorecard["matchResults"] = [];

  /*
   * A letter that turns up against two different names is the one
   * inconsistency a printed card can carry — the league's form lets the
   * rows be typed separately — and it is the one that would credit a
   * match to the wrong player. Reported, and the first name kept.
   */
  function place(
    box: Record<string, string | null>,
    slot: string,
    name: string | null,
    where: string,
  ): void {
    if (!name) return;
    const held = box[slot];
    if (held && held !== name) {
      problems.push(`${slot} is ${held} in one match and ${name} in ${where}.`);
      return;
    }
    box[slot] = name;
  }

  let singles = 0;
  for (const row of html.split(/<tr\b/i).slice(1)) {
    const cells = cellsOf(row);
    if (cells.length < 8) continue;

    const home = text(cells[0]!);
    const away = text(cells[1]!);
    const games = cells
      .slice(2, 7)
      .map(pair)
      .filter((game): game is [number, number] => game !== null) as Game[];
    const result = pair(cells[7]!);

    const singlesHome = home.match(/^([ABC])\s+(.+)$/);
    const singlesAway = away.match(/^([XYZ])\s+(.+)$/);
    if (singlesHome && singlesAway) {
      const expected = SINGLES_ORDER[singles];
      const [homeSlot, awaySlot] = [singlesHome[1]!, singlesAway[1]!];
      singles += 1;
      if (!expected || expected[0] !== homeSlot || expected[1] !== awaySlot) {
        problems.push(
          `Singles row ${singles} is ${homeSlot} v ${awaySlot}; the league's order has ` +
            `${expected ? `${expected[0]} v ${expected[1]}` : "no such row"}.`,
        );
      }
      place(homePlayers, homeSlot, singlesHome[2]!.trim(), `match ${singles}`);
      place(awayPlayers, awaySlot, singlesAway[2]!.trim(), `match ${singles}`);
      rubbers.push({
        rubberNumber: singles,
        homePlayer: singlesHome[2]!.trim(),
        homePlayer2: null,
        awayPlayer: singlesAway[2]!.trim(),
        awayPlayer2: null,
        games,
      });
      matchResults[singles - 1] = result;
      continue;
    }

    const doubles = home.match(/^Doubles:\s*([ABC])\s*&\s*([ABC])$/i);
    const doublesAway = away.match(/^([XYZ])\s*&\s*([XYZ])$/);
    if (doubles && doublesAway) {
      // Named by letter, so the names come from the singles above. Held as
      // letters until every singles row has been read.
      rubbers.push({
        rubberNumber: DOUBLES_RUBBER,
        homePlayer: doubles[1]!,
        homePlayer2: doubles[2]!,
        awayPlayer: doublesAway[1]!,
        awayPlayer2: doublesAway[2]!,
        games,
      });
      matchResults[DOUBLES_RUBBER - 1] = result;
    }
  }

  // Letters to names, now the line-up is complete.
  const doublesRow = rubbers.find((rubber) => rubber.rubberNumber === DOUBLES_RUBBER);
  if (doublesRow) {
    const home = homePlayers as Record<string, string | null>;
    const away = awayPlayers as Record<string, string | null>;
    const letters = [doublesRow.homePlayer, doublesRow.homePlayer2, doublesRow.awayPlayer, doublesRow.awayPlayer2];
    doublesRow.homePlayer = home[letters[0]!] ?? null;
    doublesRow.homePlayer2 = home[letters[1]!] ?? null;
    doublesRow.awayPlayer = away[letters[2]!] ?? null;
    doublesRow.awayPlayer2 = away[letters[3]!] ?? null;
    if (letters.some((letter, i) => letter && !(i < 2 ? home : away)[letter])) {
      problems.push(`The doubles names a letter (${letters.join(", ")}) that no singles row does.`);
    }
  } else {
    problems.push("There is no doubles row.");
  }

  if (singles !== SINGLES_ORDER.length) {
    problems.push(`${singles} singles rows; a card has ${SINGLES_ORDER.length}.`);
  }

  const finalPair = final ? pair(final[1]!) : null;
  if (!finalPair) problems.push("No final result on the card.");

  return {
    card: {
      playedOn: date ? isoDate(date[1]!, date[2]!, date[3]!) : null,
      homeTeamName: teams ? text(teams[1]!) : null,
      awayTeamName: teams ? text(teams[2]!) : null,
      startTime: null,
      finishTime: null,
      homePlayers,
      awayPlayers,
      rubbers,
    },
    division: division ? text(division[1]!) || null : null,
    finalResult: finalPair,
    matchResults,
    postedBy: posted ? text(posted[2]!) : null,
    postedAt: posted ? text(posted[1]!) : null,
    problems,
  };
}
