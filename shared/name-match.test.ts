import { describe, expect, it } from "vitest";
import { matchName, normalise, resolveName, splitPair } from "./name-match.js";

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
    // Reported as "surname", because on this squad the surname alone
    // identified them — the initial only agreed. "initial" is reserved for
    // where the initial is what separated two players sharing a surname,
    // which is the case worth being told about.
    expect(matchName("S. Trakru", squad)).toEqual({ id: "1", how: "surname" });
    expect(matchName("A Patel", squad)?.id).toBe("2");
  });

  it("separates two players who share a surname by their initial", () => {
    const brothers = [
      { id: "1", fullName: "Sam Patel" },
      { id: "2", fullName: "Anuj Patel" },
    ];
    expect(matchName("A. Patel", brothers)?.id).toBe("2");
    expect(matchName("S Patel", brothers)?.id).toBe("1");
  });

  it("returns nothing for a name nobody in the squad has", () => {
    expect(matchName("Bradley Tuttle", squad)).toBeNull();
    expect(matchName("", squad)).toBeNull();
    expect(matchName(null, squad)).toBeNull();
  });
});

describe("a first name on its own", () => {
  /*
   * The common case, and the one this used to fail on completely. Cards are
   * filled in among people who all know each other, so "Sunil" is what
   * actually gets written — and treating it only as a surname meant nearly
   * every name on a real card came back unmatched.
   */
  it("matches when one player answers to it", () => {
    expect(matchName("Sunil", squad)).toEqual({ id: "1", how: "first" });
    expect(matchName("rai", squad)?.id).toBe("3");
  });

  it("still matches when written with something after it", () => {
    expect(matchName("Sunil T", squad)?.id).toBe("1");
  });

  it("asks when two players share it", () => {
    const both = [
      { id: "1", fullName: "Sam Patel" },
      { id: "2", fullName: "Sam Whitfield" },
    ];
    const resolved = resolveName("Sam", both);
    expect(resolved.id).toBeNull();
    expect(resolved.how).toBe("first");
    // The editor is shown these two, rather than an empty box and no clue
    // which people the card could have meant.
    expect(resolved.options).toEqual(["1", "2"]);
  });

  it("does not choose between a given name and somebody's surname", () => {
    // "Sam" is Sam Jones's given name and Ali Sam's surname. Preferring the
    // given name here would be a coin toss dressed up as a rule.
    const awkward = [
      { id: "1", fullName: "Sam Jones" },
      { id: "2", fullName: "Ali Sam" },
    ];
    const resolved = resolveName("Sam", awkward);
    expect(resolved.id).toBeNull();
    expect(resolved.options).toEqual(["1", "2"]);
  });
});

describe("when a name could be two people", () => {
  it("names both rather than saying nothing", () => {
    const brothers = [
      { id: "1", fullName: "Sam Patel" },
      { id: "2", fullName: "Anuj Patel" },
    ];
    const resolved = resolveName("Patel", brothers);
    expect(resolved.id).toBeNull();
    expect(resolved.options).toEqual(["1", "2"]);
  });

  it("does so for an initial that fits two of them as well", () => {
    const twins = [
      { id: "1", fullName: "Sam Patel" },
      { id: "2", fullName: "Sara Patel" },
    ];
    const resolved = resolveName("S. Patel", twins);
    expect(resolved.id).toBeNull();
    expect(resolved.how).toBe("initial");
    expect(resolved.options).toEqual(["1", "2"]);
  });

  it("does so when the squad holds the same name twice", () => {
    const duplicated = [
      { id: "1", fullName: "Sunil Trakru" },
      { id: "2", fullName: "Sunil Trakru" },
    ];
    const resolved = resolveName("Sunil Trakru", duplicated);
    expect(resolved.id).toBeNull();
    expect(resolved.options).toEqual(["1", "2"]);
  });

  it("offers nobody when nobody answers to the name", () => {
    expect(resolveName("Bradley Tuttle", squad)).toEqual({ id: null, how: null, options: [] });
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
