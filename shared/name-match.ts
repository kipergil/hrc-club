/**
 * Matching a name read off a card to a player the site holds.
 *
 * A handwritten card gives you "S. Trakru", "Sunil T", "SUNIL TRAKRU", or —
 * far more often than any of those — just **"Sunil"**. Captains fill the
 * sheet in among people who all know each other, so the first name alone is
 * usually enough for the room and is what actually gets written. The squad,
 * meanwhile, gives you "Sunil Trakru". These have to meet somewhere.
 *
 * Two rules govern where.
 *
 * **Confident or nothing.** Each strategy is exact about something — the
 * whole name, the given name, the surname, the surname plus an initial —
 * and every one of them requires the answer to be unique. Fuzzy distance
 * scoring is deliberately absent: it is what produces confident wrong
 * answers on a three-player squad where two share a surname, and a wrong
 * match silently credits a rubber to the wrong player and surfaces months
 * later in an averages table nobody can explain.
 *
 * **An ambiguous name is a question, not a silence.** Where two players
 * answer to "Sam", saying nothing leaves the editor to work out both who
 * the card meant and which two people it could have been. So the
 * resolution carries the candidates it could not choose between, and the
 * form asks. That is the difference between "not matched" and "which of
 * these two?", and it is most of the work of checking a card.
 */

export interface Candidate {
  id: string;
  fullName: string;
}

/** How a name was matched, so the form can say why and how sure to be. */
export type MatchStrategy = "exact" | "first" | "surname" | "initial";

export interface NameResolution {
  /** The one player this name can be. Null when there is none, or several. */
  id: string | null;
  how: MatchStrategy | null;
  /**
   * Everyone the name could mean, when it could mean more than one. Empty
   * when it matched or when nobody answered to it at all.
   */
  options: string[];
}

const NOTHING: NameResolution = { id: null, how: null, options: [] };

/** Lower-case, unpunctuated, single-spaced. */
export function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'`’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parts(name: string): string[] {
  return normalise(name).split(" ").filter(Boolean);
}

function surnameOf(name: string): string {
  const words = parts(name);
  return words[words.length - 1] ?? "";
}

function firstOf(name: string): string {
  return parts(name)[0] ?? "";
}

/** One when exactly one, ambiguous when several, nothing when none. */
function decide(found: Candidate[], how: MatchStrategy): NameResolution | null {
  if (found.length === 1) return { id: found[0]!.id, how, options: [] };
  if (found.length > 1) return { id: null, how, options: found.map((one) => one.id) };
  return null;
}

/**
 * Who a name on the card means.
 *
 * The order matters and is chosen from what cards actually say: the full
 * name if it is written out, then the given name, then the surname. Given
 * names come before surnames because that is overwhelmingly what a single
 * word on a card is — and because trying it as a surname first would fail
 * on nearly every card the league produces.
 */
export function resolveName(
  raw: string | null | undefined,
  candidates: Candidate[],
): NameResolution {
  if (!raw) return NOTHING;
  const name = normalise(raw);
  if (!name) return NOTHING;

  // Written out in full. Two players with identical names is a data
  // problem, and asking is the only honest thing to do with it.
  const exact = decide(
    candidates.filter((candidate) => normalise(candidate.fullName) === name),
    "exact",
  );
  if (exact) return exact;

  const words = parts(name);

  if (words.length === 1) {
    const word = words[0]!;
    const byFirst = candidates.filter((candidate) => firstOf(candidate.fullName) === word);
    const bySurname = candidates.filter(
      (candidate) => surnameOf(candidate.fullName) === word && !byFirst.includes(candidate),
    );

    /*
     * Both pools together, because "Sam" against a squad holding Sam Jones
     * and Ali Sam is genuinely ambiguous — matching the given name first
     * would be a coin toss dressed up as a rule. Only when the two pools
     * together name exactly one person is there an answer.
     */
    const pool = [...byFirst, ...bySurname];
    return decide(pool, byFirst.length > 0 ? "first" : "surname") ?? NOTHING;
  }

  /*
   * More than one word: the last is the surname, unless no one answers to
   * it — a card that says "Sunil T" has given a first name and an initial,
   * which is the other way round.
   */
  const bySurname = candidates.filter(
    (candidate) => surnameOf(candidate.fullName) === surnameOf(name),
  );

  if (bySurname.length === 1) return { id: bySurname[0]!.id, how: "surname", options: [] };

  if (bySurname.length > 1) {
    /*
     * "S. Trakru" or "Sunil Trakru" against the players sharing that
     * surname. The first letter of the given name has to agree, which is
     * what stops "S. Trakru" matching the only other Trakru, who is Rai.
     */
    const initial = words[0]![0];
    const byInitial = bySurname.filter(
      (candidate) => firstOf(candidate.fullName)[0] === initial,
    );
    return (
      decide(byInitial, "initial") ?? {
        id: null,
        how: "surname",
        options: bySurname.map((one) => one.id),
      }
    );
  }

  // Nobody has that surname, so read it as a given name and something else
  // — "Sunil T", "Sam (capt)".
  return decide(
    candidates.filter((candidate) => firstOf(candidate.fullName) === words[0]),
    "first",
  ) ?? NOTHING;
}

export interface NameMatch {
  id: string;
  how: MatchStrategy;
}

/** `resolveName` for callers that only want an unambiguous answer. */
export function matchName(
  raw: string | null | undefined,
  candidates: Candidate[],
): NameMatch | null {
  const resolved = resolveName(raw, candidates);
  return resolved.id && resolved.how ? { id: resolved.id, how: resolved.how } : null;
}

/**
 * A doubles cell often reads "Trakru & Patel" or "S Trakru / A Patel".
 * Split it before matching, because neither half will match on its own
 * while they are still one string.
 */
export function splitPair(raw: string | null | undefined): [string | null, string | null] {
  if (!raw) return [null, null];
  const halves = raw.split(/\s*(?:&|\+|\/|\band\b)\s*/i).map((half) => half.trim()).filter(Boolean);
  if (halves.length >= 2) return [halves[0]!, halves[1]!];
  return [halves[0] ?? null, null];
}
