import { beforeEach, describe, expect, it, vi } from "vitest";
import { DOUBLES_RUBBER, RUBBERS_PER_MATCH, type ScorecardInput } from "../shared/scorecard.js";

/**
 * Building the draft the review screen edits.
 *
 * The card names six players once, against the letters, and the printed
 * pairing order supplies every singles rubber from there. These tests are
 * about that arithmetic: a name read once must reach all three of the
 * rubbers that player appears in, and a name that fits two people must
 * arrive as a question rather than as silence.
 */

const { getFixtureSquads } = vi.hoisted(() => ({ getFixtureSquads: vi.fn() }));
vi.mock("./storage.js", () => ({ getFixtureSquads }));

const { buildDraft } = await import("./lib/scorecard-draft.js");

const HOME = [
  { id: "h1", fullName: "Sunil Trakru", slug: "sunil-trakru" },
  { id: "h2", fullName: "Anuj Patel", slug: "anuj-patel" },
  { id: "h3", fullName: "Rai Liiv", slug: "rai-liiv" },
];
const AWAY = [
  { id: "a1", fullName: "Sam Jones", slug: "sam-jones" },
  { id: "a2", fullName: "Sam Whitfield", slug: "sam-whitfield" },
  { id: "a3", fullName: "Dave Blake", slug: "dave-blake" },
];

function card(overrides: Partial<ScorecardInput> = {}): ScorecardInput {
  return {
    playedOn: "2026-09-23",
    homeTeamName: "HRC B",
    awayTeamName: "Water Lane A",
    startTime: null,
    finishTime: null,
    // First names only, which is what a real card says.
    homePlayers: { A: "Sunil", B: "Anuj", C: "Rai" },
    awayPlayers: { X: "Dave", Y: "Sam", Z: null },
    rubbers: Array.from({ length: RUBBERS_PER_MATCH }, (_, i) => ({
      rubberNumber: i + 1,
      homePlayer: null,
      homePlayer2: null,
      awayPlayer: null,
      awayPlayer2: null,
      games: [
        [11, 8],
        [11, 6],
        [11, 9],
      ] as Array<[number, number]>,
    })),
    ...overrides,
  };
}

beforeEach(() => {
  getFixtureSquads.mockResolvedValue({
    fixture: {
      id: "fixture-1",
      playedOn: "2026-09-23",
      homeTeam: { name: "HRC B", slug: "hrc-b" },
      awayTeam: { name: "Water Lane A", slug: "water-lane-a" },
    },
    homeSquad: HOME,
    awaySquad: AWAY,
  });
});

describe("the line-up", () => {
  it("matches first names, which is what cards actually carry", async () => {
    const draft = (await buildDraft("fixture-1", card()))!;

    expect(draft.homeLineup.map((slot) => [slot.slot, slot.memberId])).toEqual([
      ["A", "h1"],
      ["B", "h2"],
      ["C", "h3"],
    ]);
    expect(draft.homeLineup.every((slot) => slot.how === "first")).toBe(true);
  });

  it("asks which player when a first name fits two of them", async () => {
    const draft = (await buildDraft("fixture-1", card()))!;
    const y = draft.awayLineup.find((slot) => slot.slot === "Y")!;

    // Two Sams in the away squad. Not a match, and not a silence either.
    expect(y.memberId).toBeNull();
    expect(y.options).toEqual(["a1", "a2"]);
    expect(
      draft.warnings.some(
        (warning) => warning.field === "away.Y" && warning.message.includes("Sam Jones or Sam Whitfield"),
      ),
    ).toBe(true);
  });

  it("says nothing about a slot the card left blank", async () => {
    const draft = (await buildDraft("fixture-1", card()))!;
    const z = draft.awayLineup.find((slot) => slot.slot === "Z")!;

    expect(z.name).toBeNull();
    expect(z.memberId).toBeNull();
    // An empty slot is a blank to fill in, not a problem to report.
    expect(draft.warnings.some((warning) => warning.field === "away.Z")).toBe(false);
  });

  it("falls back to the rows when the line-up box was left blank", async () => {
    const rowsOnly = card({
      homePlayers: { A: null, B: null, C: null },
      awayPlayers: { X: null, Y: null, Z: null },
    });
    // Rubber 1 is A v X, so these two rows name A and X.
    rowsOnly.rubbers[0]!.homePlayer = "Sunil";
    rowsOnly.rubbers[0]!.awayPlayer = "Dave";

    const draft = (await buildDraft("fixture-1", rowsOnly))!;

    expect(draft.homeLineup.find((slot) => slot.slot === "A")?.memberId).toBe("h1");
    expect(draft.awayLineup.find((slot) => slot.slot === "X")?.memberId).toBe("a3");
  });
});

describe("the rubbers", () => {
  it("gives every singles the players its letters imply", async () => {
    const draft = (await buildDraft("fixture-1", card()))!;

    /*
     * A plays rubbers 1, 5 and 9 under the printed order, and it is the
     * same person in all three. Resolving each row separately — as this
     * used to — meant three chances to disagree with itself, and three
     * places for the editor to fix the same misread name.
     */
    for (const number of [1, 5, 9]) {
      const rubber = draft.rubbers.find((one) => one.rubberNumber === number)!;
      expect(rubber.homePlayerId).toBe("h1");
    }
    // X plays 1, 4 and 8.
    for (const number of [1, 4, 8]) {
      expect(draft.rubbers.find((one) => one.rubberNumber === number)!.awayPlayerId).toBe("a3");
    }
  });

  it("leaves a singles unfilled where the letter is unresolved", async () => {
    const draft = (await buildDraft("fixture-1", card()))!;
    // Y is the ambiguous Sam, and plays rubbers 2, 6 and 9.
    for (const number of [2, 6, 9]) {
      const rubber = draft.rubbers.find((one) => one.rubberNumber === number)!;
      expect(rubber.awayPlayerId).toBeNull();
      expect(rubber.awayPlayerName).toBe("Sam");
    }
  });

  it("reads the doubles pair from the card, since its letters are not fixed", async () => {
    const withDoubles = card();
    withDoubles.rubbers[DOUBLES_RUBBER - 1]!.homePlayer = "Sunil & Rai";
    withDoubles.rubbers[DOUBLES_RUBBER - 1]!.awayPlayer = "Dave & Sam Jones";

    const draft = (await buildDraft("fixture-1", withDoubles))!;
    const doubles = draft.rubbers.find((one) => one.rubberNumber === DOUBLES_RUBBER)!;

    expect(doubles.kind).toBe("doubles");
    expect(doubles.homePlayerId).toBe("h1");
    expect(doubles.homePlayer2Id).toBe("h3");
    expect(doubles.awayPlayerId).toBe("a3");
    expect(doubles.awayPlayer2Id).toBe("a1");
  });

  it("is always ten rubbers, even from nothing at all", async () => {
    const draft = (await buildDraft("fixture-1", null))!;

    expect(draft.rubbers).toHaveLength(RUBBERS_PER_MATCH);
    expect(draft.homeLineup).toHaveLength(3);
    expect(draft.awayLineup).toHaveLength(3);
    // A blank card is not a card with problems; nobody has filled it in yet.
    expect(draft.warnings).toEqual([]);
  });
});
