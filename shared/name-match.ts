/**
 * Matching a name read off a card to a player the site holds.
 *
 * A handwritten card gives you "S. Trakru", "Sunil T", "SUNIL TRAKRU" or
 * a model's best guess at a scrawl. The squad gives you "Sunil Trakru".
 * These have to meet somewhere, and where they meet matters: a wrong
 * match silently credits a rubber to the wrong player and shows up months
 * later in an averages table nobody can explain.
 *
 * So the rule is **confident or nothing**. Each strategy below is exact
 * about something — the whole name, the surname, the surname plus an
 * initial — and anything short of that returns no match and leaves the
 * name as written for a human to resolve in the form. Fuzzy distance
 * scoring is deliberately absent: it is the thing that produces confident
 * wrong answers on a three-player squad where two share a surname.
 */

export interface Candidate {
  id: string;
  fullName: string;
}

export interface NameMatch {
  id: string;
  /** How it was matched, so the form can say why and how sure to be. */
  how: "exact" | "surname" | "initial";
}

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

/**
 * The one candidate this name can only be, or null.
 *
 * Every strategy requires the answer to be unique among the candidates.
 * "S. Smith" against a squad containing two Smiths is not a match, it is
 * a question, and the form is where questions get asked.
 */
export function matchName(raw: string | null | undefined, candidates: Candidate[]): NameMatch | null {
  if (!raw) return null;
  const name = normalise(raw);
  if (!name) return null;

  const exact = candidates.filter((candidate) => normalise(candidate.fullName) === name);
  if (exact.length === 1) return { id: exact[0]!.id, how: "exact" };
  // Two players with identical names is a data problem, not a match.
  if (exact.length > 1) return null;

  const surname = surnameOf(name);
  if (!surname) return null;

  const bySurname = candidates.filter((candidate) => surnameOf(candidate.fullName) === surname);
  if (bySurname.length === 0) return null;

  // "Trakru" alone, and only one Trakru in the squad.
  if (parts(name).length === 1) {
    return bySurname.length === 1 ? { id: bySurname[0]!.id, how: "surname" } : null;
  }

  /*
   * "S. Trakru" or "Sunil Trakru" against the surname matches. The first
   * letter of the given name has to agree — which is what stops "S.
   * Trakru" matching a "Rai Trakru" who happens to be the only other
   * person with that surname.
   */
  const initial = parts(name)[0]![0];
  const byInitial = bySurname.filter((candidate) => parts(candidate.fullName)[0]?.[0] === initial);
  if (byInitial.length === 1) {
    return { id: byInitial[0]!.id, how: initial === undefined ? "surname" : "initial" };
  }

  return null;
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
