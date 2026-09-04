import { describe, expect, it } from "vitest";
import { MAX_EDGE, base64Bytes, fitWithin } from "./image";

/**
 * The arithmetic behind the fix for uploads that stopped for no stated
 * reason. Redrawing a photograph needs a canvas and is checked in a
 * browser; the sizing decision is pure and is checked here, because it is
 * the part that decides whether the request is under the platform's cap or
 * refused at the edge where nothing can report it.
 */

describe("sizing a photographed card", () => {
  it("brings a phone photograph down to the long edge", () => {
    // A 12-megapixel camera, landscape and portrait — the two ways a card
    // actually gets photographed.
    expect(fitWithin(4032, 3024)).toEqual({ width: 1800, height: 1350 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1350, height: 1800 });
  });

  it("leaves a small photograph alone rather than blowing it up", () => {
    /*
     * Enlarging would cost bytes and add nothing: a card photographed at
     * 900px is a card photographed at 900px, and interpolating it to 1800
     * invents detail the model would then read as though it were there.
     */
    expect(fitWithin(900, 675)).toEqual({ width: 900, height: 675 });
    expect(fitWithin(MAX_EDGE, MAX_EDGE)).toEqual({ width: MAX_EDGE, height: MAX_EDGE });
  });

  it("never rounds a dimension to zero", () => {
    // A canvas of zero width throws rather than producing a small image.
    const { width, height } = fitWithin(20_000, 3);
    expect(width).toBe(MAX_EDGE);
    expect(height).toBeGreaterThanOrEqual(1);
  });

  it("survives a file it could not measure", () => {
    expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0 });
  });

  it("keeps the aspect ratio, so the card is not stretched", () => {
    const { width, height } = fitWithin(4000, 2000);
    expect(width / height).toBeCloseTo(2, 5);
  });
});

describe("measuring what will be sent", () => {
  /*
   * The number that matters: the platform refuses a body over 4.5MB at the
   * edge, before the server sees it, so the size has to be known here.
   */
  it("reads the decoded size out of a base64 string", () => {
    expect(base64Bytes("")).toBe(0);
    expect(base64Bytes("QQ==")).toBe(1); // "A"
    expect(base64Bytes("QUI=")).toBe(2); // "AB"
    expect(base64Bytes("QUJD")).toBe(3); // "ABC"
  });

  it("is close enough to judge a real payload by", () => {
    const megabyte = "A".repeat(4 * 1_048_576);
    // Base64 is four characters per three bytes, so this is ~3MB of image.
    expect(base64Bytes(megabyte) / 1_048_576).toBeCloseTo(3, 1);
  });
});
