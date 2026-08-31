import type { Venue } from "@shared/types.js";

/**
 * Addresses and map links, in one place.
 *
 * Pure and tested because both of the things here are easy to get subtly
 * wrong in a way nothing catches: an address that renders with a stray
 * comma where a field is empty, and a maps link that silently drops the
 * venue and opens on the middle of England.
 */

/** The venue's address as a person would write it, skipping empty fields. */
export function addressLines(venue: Pick<Venue, "addressLine1" | "addressLine2" | "town" | "postcode">): string[] {
  return [venue.addressLine1, venue.addressLine2, venue.town, venue.postcode]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));
}

export function addressText(venue: Parameters<typeof addressLines>[0]): string {
  return addressLines(venue).join(", ");
}

export function hasPoint(venue: Pick<Venue, "latitude" | "longitude">): boolean {
  return typeof venue.latitude === "number" && typeof venue.longitude === "number";
}

/**
 * A Google Maps link for a venue.
 *
 * Google's documented universal URL, which needs no API key and opens the
 * Google Maps app rather than the website where one is installed.
 *
 * Coordinates are preferred over the address because they cannot be
 * misread: several of these halls share a name with a building in another
 * county, and "Village Hall, Furneux Pelham" is exactly the kind of query
 * a search will answer confidently and wrongly. The address is the
 * fallback for a venue that has not been geocoded yet, and a venue with
 * neither gets no link at all rather than one that opens nowhere.
 */
export function googleMapsUrl(
  venue: Pick<Venue, "name" | "latitude" | "longitude" | "addressLine1" | "addressLine2" | "town" | "postcode">,
): string | null {
  if (hasPoint(venue)) {
    const query = `${venue.latitude},${venue.longitude}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  const address = addressText(venue);
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name}, ${address}`)}`;
}

/**
 * Is the venue's stored `map_url` just another Google Maps link?
 *
 * Every one currently is: the league wrote them as
 * `google.com/maps/search/<name>, <address>`. Shown next to this site's
 * own "Open in Google Maps" button that is the same destination twice,
 * and the stored one is the weaker of the two — it searches on a name,
 * which is how "Village Hall, Furneux Pelham" ends up in the wrong
 * county, where the button uses coordinates.
 *
 * So the stored link is rendered only when it points somewhere Google
 * is not, which keeps the field useful for a venue whose club would
 * rather send people to a hall's own directions page.
 */
export function isGoogleMapsUrl(url: string | null): boolean {
  if (!url) return false;

  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    // Not a URL at all. Whatever it is, it is not Google's.
    return false;
  }

  /*
   * By domain label, not by substring or a regex over the whole host.
   * "google" has to be the registrable name, immediately before the
   * public suffix — so `maps.google.co.uk` counts and
   * `google.example.com` does not. Both a `hostname.includes("google")`
   * check and the obvious regex get that second one wrong, and getting it
   * wrong means an attacker-chosen host suppresses the real link.
   */
  const labels = hostname.split(".");
  const index = labels.lastIndexOf("google");
  if (index === -1) return false;

  const suffix = labels.slice(index + 1);
  return suffix.length >= 1 && suffix.length <= 2 && suffix.every((label) => /^[a-z]{2,4}$/.test(label));
}

/**
 * The box that holds every pin, and the point to centre a single one on.
 *
 * Returned rather than computed inside the map component so the "no
 * venue has been geocoded" case is a value the page can check, not a
 * Leaflet call that throws on an empty bounds object.
 */
export interface MapExtent {
  points: Array<{ venue: Venue; latitude: number; longitude: number }>;
  /** South-west then north-east, as Leaflet wants them. */
  bounds: [[number, number], [number, number]] | null;
}

export function extentOf(venues: Venue[]): MapExtent {
  const points = venues
    .filter(hasPoint)
    .map((venue) => ({ venue, latitude: venue.latitude!, longitude: venue.longitude! }));

  if (points.length === 0) return { points, bounds: null };

  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  return {
    points,
    bounds: [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ],
  };
}

/**
 * OpenStreetMap's own tiles.
 *
 * This was written first against CARTO's Positron and Dark Matter, which
 * are quieter than OSM's standard style and come as a light/dark pair
 * that would have matched the site's two themes. They are also, as of
 * now, watermarked "API KEY REQUIRED" straight across every tile — which
 * only showed up when the map was actually rendered and looked at. Esri's
 * grey canvas basemaps come back clean and unwatermarked and were the
 * obvious swap, but they split labels into a second layer and their
 * licensing for anonymous use is not something to guess at.
 *
 * So: the standard OSM tiles. Not the prettiest of the three, and there
 * is no dark variant, but the tile usage policy explicitly covers sites
 * this size, the labels are in the tile, there is no key to keep alive,
 * and it will still be working in five years with nobody watching it.
 * That is the right trade for a volunteer-run club site, and the CARTO
 * watermark is what it looks like when it is got wrong.
 *
 * Attribution is required, and Leaflet renders it into the corner.
 */
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Options every tile layer on this site uses.
 *
 * Out here, rather than inline at the one call site, so `maps.test.ts`
 * can assert the referrer policy is still set. It is one word, it is
 * invisible, deleting it breaks the map completely, and nothing else
 * would notice — see below.
 */
export const TILE_LAYER_OPTIONS = {
  attribution: TILE_ATTRIBUTION,
  maxZoom: 19,
  /*
   * Without this the map is a wall of "Access blocked" tiles in
   * production, and nothing anywhere reports a problem.
   *
   * The site sends `Referrer-Policy: no-referrer` on every response.
   * OpenStreetMap's tile servers identify callers by User-Agent or
   * Referer, and a browser request carrying neither is treated as an
   * unidentified script: they answer it **200** with a 7KB image reading
   * "App is not following the tile usage policy" in place of the map. A
   * 200 with a picture in it is not something a fetch, a test, or a
   * person glancing at the network tab would call a failure.
   *
   * Leaflet puts this on the tile `<img>` elements, where an
   * element-level policy beats the document's. `origin` sends
   * `https://hertsttl.org.uk/` and nothing more — the site's identity,
   * which is exactly what the policy asks for, and none of the per-page
   * detail `no-referrer` exists to withhold.
   */
  referrerPolicy: "origin",
} as const;
