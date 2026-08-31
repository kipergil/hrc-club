import { describe, expect, it } from "vitest";
import type { Venue } from "@shared/types.js";
import {
  TILE_ATTRIBUTION,
  TILE_LAYER_OPTIONS,
  TILE_URL,
  addressLines,
  addressText,
  extentOf,
  googleMapsUrl,
  hasPoint,
  isGoogleMapsUrl,
} from "./maps";

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "v1",
    name: "Bushby Hall",
    slug: "bushby-hall",
    addressLine1: "8 Wharf Road",
    addressLine2: null,
    town: "Wormley",
    postcode: "EN10 6HX",
    mapUrl: null,
    latitude: 51.73233,
    longitude: -0.02277,
    directions: null,
    parkingNotes: null,
    accessibilityNotes: null,
    tableCount: null,
    isHomeVenue: false,
    photoId: null,
    ...overrides,
  };
}

describe("addressLines", () => {
  it("keeps the fields that are filled in, in postal order", () => {
    expect(addressLines(venue())).toEqual(["8 Wharf Road", "Wormley", "EN10 6HX"]);
  });

  it("drops empty fields rather than leaving a gap", () => {
    // Several venues have no second address line, and a naive join gives
    // "8 Wharf Road, , Wormley".
    expect(addressText(venue({ addressLine2: null }))).toBe("8 Wharf Road, Wormley, EN10 6HX");
  });

  it("treats a whitespace-only field as empty", () => {
    expect(addressLines(venue({ addressLine2: "   " }))).toEqual([
      "8 Wharf Road",
      "Wormley",
      "EN10 6HX",
    ]);
  });

  it("copes with a venue that has no address at all", () => {
    expect(
      addressText(venue({ addressLine1: null, addressLine2: null, town: null, postcode: null })),
    ).toBe("");
  });
});

describe("hasPoint", () => {
  it("is true only when both coordinates are numbers", () => {
    expect(hasPoint(venue())).toBe(true);
    expect(hasPoint(venue({ latitude: null }))).toBe(false);
    expect(hasPoint(venue({ longitude: null }))).toBe(false);
  });

  it("accepts a coordinate of exactly zero", () => {
    // Greenwich is on longitude 0, and this league is close enough to it
    // that a falsy check here would be a real bug rather than a hypothetical
    // one — Stanstead Abbotts sits at 0.0105.
    expect(hasPoint(venue({ longitude: 0 }))).toBe(true);
  });
});

describe("googleMapsUrl", () => {
  it("uses the coordinates when the venue has been geocoded", () => {
    const url = googleMapsUrl(venue())!;
    expect(url).toContain("google.com/maps/search/?api=1");
    expect(url).toContain(encodeURIComponent("51.73233,-0.02277"));
  });

  it("prefers coordinates over the address, because a name can be misread", () => {
    // "Village Hall, Furneux Pelham" is exactly the kind of query a search
    // answers confidently and wrongly.
    const url = googleMapsUrl(venue({ name: "Village Hall" }))!;
    expect(url).not.toContain("Village");
  });

  it("falls back to the address for a venue with no coordinates", () => {
    const url = googleMapsUrl(venue({ latitude: null, longitude: null }))!;
    expect(decodeURIComponent(url)).toContain("Bushby Hall, 8 Wharf Road, Wormley, EN10 6HX");
  });

  it("returns nothing when there is neither a point nor an address", () => {
    expect(
      googleMapsUrl(
        venue({
          latitude: null,
          longitude: null,
          addressLine1: null,
          addressLine2: null,
          town: null,
          postcode: null,
        }),
      ),
    ).toBeNull();
  });

  it("escapes the query rather than pasting it in raw", () => {
    const url = googleMapsUrl(
      venue({ latitude: null, longitude: null, name: "St. Andrews Centre & Hall" }),
    )!;
    expect(url).not.toContain("&Hall");
    expect(url).toContain("%26");
  });
});

describe("extentOf", () => {
  it("returns a box that contains every pin", () => {
    const { bounds, points } = extentOf([
      venue({ id: "a", latitude: 51.7, longitude: -0.1 }),
      venue({ id: "b", latitude: 51.9, longitude: 0.2 }),
    ]);
    expect(points).toHaveLength(2);
    expect(bounds).toEqual([
      [51.7, -0.1],
      [51.9, 0.2],
    ]);
  });

  it("leaves out venues that have not been geocoded", () => {
    const { points } = extentOf([venue({ id: "a" }), venue({ id: "b", latitude: null })]);
    expect(points.map((point) => point.venue.id)).toEqual(["a"]);
  });

  it("gives a single venue a box of its own point", () => {
    const { bounds } = extentOf([venue({ latitude: 51.5, longitude: -0.1 })]);
    expect(bounds).toEqual([
      [51.5, -0.1],
      [51.5, -0.1],
    ]);
  });

  it("reports no bounds rather than an empty box when nothing is plottable", () => {
    // The map component checks this instead of handing Leaflet an empty
    // bounds object, which throws.
    expect(extentOf([venue({ latitude: null, longitude: null })])).toEqual({
      points: [],
      bounds: null,
    });
    expect(extentOf([])).toEqual({ points: [], bounds: null });
  });
});

describe("isGoogleMapsUrl", () => {
  it("recognises the links the league already stored", () => {
    // Every venue's `map_url` currently looks like this, which is why the
    // page would otherwise show the same destination twice.
    expect(
      isGoogleMapsUrl("https://www.google.com/maps/search/Bushby%20Hall%2C%208%20Wharf%20Road"),
    ).toBe(true);
    expect(isGoogleMapsUrl("https://maps.google.co.uk/?q=Hertford")).toBe(true);
  });

  it("leaves a link to somewhere else alone", () => {
    expect(isGoogleMapsUrl("https://www.openstreetmap.org/#map=17/51.73/-0.02")).toBe(false);
    expect(isGoogleMapsUrl("https://bushbyhall.example/directions")).toBe(false);
  });

  it("is not fooled by a host that merely contains the word", () => {
    // `hostname.includes("google")` would call both of these Google.
    expect(isGoogleMapsUrl("https://google.example.com/maps")).toBe(false);
    expect(isGoogleMapsUrl("https://notgoogle.com/maps")).toBe(false);
  });

  it("treats a missing or unparseable value as not-Google", () => {
    expect(isGoogleMapsUrl(null)).toBe(false);
    expect(isGoogleMapsUrl("not a url")).toBe(false);
  });
});

describe("tile layer options", () => {
  it("sets a referrer policy on the tiles", () => {
    /*
     * The regression this guards is invisible and total. The site sends
     * `Referrer-Policy: no-referrer`; OpenStreetMap answers a request with
     * no Referer and no recognised User-Agent with HTTP **200** and a 7KB
     * "Access blocked" image instead of the map. Delete this one option
     * and every map on the site becomes a grid of that notice, with no
     * failed request, no console error and nothing in the logs.
     */
    expect(TILE_LAYER_OPTIONS.referrerPolicy).toBe("origin");
  });

  it("credits OpenStreetMap, which their licence requires", () => {
    expect(TILE_ATTRIBUTION).toContain("OpenStreetMap");
    expect(TILE_ATTRIBUTION).toContain("openstreetmap.org/copyright");
  });

  it("loads tiles over https from the host the CSP allows", () => {
    // `img-src` names this host exactly, in both vercel.json and helmet.
    expect(TILE_URL.startsWith("https://tile.openstreetmap.org/")).toBe(true);
  });
});
