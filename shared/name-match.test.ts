import { describe, expect, it } from "vitest";
import { matchName, normalise, splitPair } from "./name-match.js";

const squad = [
  { id: "1", fullName: "Sunil Trakru" },
  { id: "2", fullName: "Anuj Patel" },
  { id: "3", fullName: "Rai Liiv" },
];

describe("matchName", () => {
  it("matches the name written out in full", () => {
    expect(matchName("Sunil Trakru", squad)).toEqual({ id: "1", how: "exact" });
  });

  it("ignores case and punctuation, which a card is careless about", () => {
    expect(matchName("SUNIL TRAKRU", squad)?.id).toBe("1");
    expect(matchName("  sunil   trakru ", squad)?.id).toBe("1");
    expect(matchName("O'Brien", [{ id: "9", fullName: "Sean OBrien" }])?.id).toBe("9");
  });

  it("matches a surname on its own when only one player has it", () => {
    expect(matchName("Trakru", squad)).toEqual({ id: "1", how: "surname" });
  });

  it("matches an initial and a surname", () => {
    expect(matchName("S. Trakru", squad)).toEqual({ id: "1", how: "initial" });
    expect(matchName("A Patel", squad)?.id).toBe("2");
  });

  it("refuses a surname two players share", () => {
    /*
     * The failure that matters. A guess here credits a rubber to the
     * wrong brother and surfaces months later in an averages table
     * nobody can explain, so an ambiguous name is left for a person.
     */
    const brothers = [
      { id: "1", fullName: "Sam Patel" },
      { id: "2", fullName: "Anuj Patel" },
    ];
    expect(matchName("Patel", brothers)).toBeNull();
  });

  it("separates two players who share a surname by their initial", () => {
    const brothers = [
      { id: "1", fullName: "Sam Patel" },
      { id: "2", fullName: "Anuj Patel" },
    ];
    expect(matchName("A. Patel", brothers)?.id).toBe("2");
    expect(matchName("S Patel", brothers)?.id).toBe("1");
  });

  it("refuses when the initial matches two of them as well", () => {
    const twins = [
      { id: "1", fullName: "Sam Patel" },
      { id: "2", fullName: "Sara Patel" },
    ];
    expect(matchName("S. Patel", twins)).toBeNull();
  });

  it("returns nothing for a name nobody in the squad has", () => {
    expect(matchName("Bradley Tuttle", squad)).toBeNull();
    expect(matchName("", squad)).toBeNull();
    expect(matchName(null, squad)).toBeNull();
  });

  it("does not match on the given name alone", () => {
    // "Sunil" is a first name; treating it as a surname would match the
    // wrong thing on a squad where somebody is called Sunil Something-else.
    expect(matchName("Sunil", squad)).toBeNull();
  });

  it("refuses when the squad holds the same name twice", () => {
    const duplicated = [
      { id: "1", fullName: "Sunil Trakru" },
      { id: "2", fullName: "Sunil Trakru" },
    ];
    expect(matchName("Sunil Trakru", duplicated)).toBeNull();
  });
});

describe("splitPair", () => {
  it("splits the ways a card writes a doubles pair", () => {
    expect(splitPair("Trakru & Patel")).toEqual(["Trakru", "Patel"]);
    expect(splitPair("S Trakru / A Patel")).toEqual(["S Trakru", "A Patel"]);
    expect(splitPair("Trakru and Patel")).toEqual(["Trakru", "Patel"]);
    expect(splitPair("Trakru + Patel")).toEqual(["Trakru", "Patel"]);
  });

  it("returns a single name as the first half", () => {
    expect(splitPair("Trakru")).toEqual(["Trakru", null]);
  });

  it("copes with nothing at all", () => {
    expect(splitPair(null)).toEqual([null, null]);
    expect(splitPair("")).toEqual([null, null]);
  });

  it("does not split a name that merely contains the letters 'and'", () => {
    // "Sandra" and "Alexander" both contain "and"; the word boundary is
    // what stops this splitting them into nonsense.
    expect(splitPair("Sandra Alexander")).toEqual(["Sandra Alexander", null]);
  });
});

describe("normalise", () => {
  it("is stable for names that differ only in styling", () => {
    expect(normalise("St. Andrews")).toBe(normalise("st andrews"));
  });
});
