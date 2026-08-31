import { readItems, updateItem } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";

/**
 * Fills in each venue's latitude and longitude, once, from OpenStreetMap's
 * Nominatim service.
 *
 * Geocoding happens here rather than in the browser or the API for the
 * reason everything else about this site is built the way it is: a map on
 * a club page must not depend on a third-party lookup succeeding while
 * somebody stands in a car park with one bar of signal. A postcode
 * resolves to a point once, is stored, and is served from our own
 * database with the rest of the venue.
 *
 * Nominatim is free and needs no key. Its usage policy asks for two
 * things in return and both are honoured below: a User-Agent that
 * identifies the caller, and no more than one request a second. Nine
 * venues take nine seconds, run perhaps twice a year.
 *
 * Idempotent, and conservative with it: a venue that already has
 * coordinates is left alone unless `--force` is passed, because somebody
 * may have corrected a bad geocode by hand and that correction should
 * outlive the next run.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/**
 * Nominatim asks that automated callers identify themselves with
 * something a maintainer could be contacted through. This is the site the
 * lookups are for.
 */
const USER_AGENT = "hrc-club-site/1.0 (+https://hertsttl.org.uk)";

/** The policy limit is one request a second. */
const THROTTLE_MS = 1100;

type Row = Record<string, any>;

interface Candidate {
  /** What is sent to Nominatim. */
  query: string;
  /** For the log, so a wrong hit is traceable to the query that found it. */
  label: string;
}

/**
 * The queries to try for a venue, most specific first.
 *
 * A UK postcode alone is the most reliable identifier Nominatim has for a
 * British address — far better than a hall name, which it will happily
 * match to a differently-named building in another county. The full
 * address is tried first because it can distinguish two halls sharing a
 * postcode; the postcode is the fallback that nearly always works.
 *
 * The venue *name* is deliberately not a fallback. "Village Hall" matches
 * several hundred buildings in England, and a confident wrong answer puts
 * a marker in the wrong town with nothing to show it is wrong.
 */
function candidatesFor(venue: Row): Candidate[] {
  const parts = [venue.address_line_1, venue.address_line_2, venue.town, venue.postcode]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);

  const candidates: Candidate[] = [];
  if (parts.length > 1) {
    candidates.push({ query: `${parts.join(", ")}, UK`, label: "full address" });
  }
  if (venue.postcode) {
    candidates.push({ query: `${String(venue.postcode).trim()}, UK`, label: "postcode" });
  }
  return candidates;
}

interface Point {
  latitude: number;
  longitude: number;
}

async function lookup(query: string): Promise<Point | null> {
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&countrycodes=gb`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!response.ok) throw new Error(`Nominatim returned HTTP ${response.status}`);

  const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
  const first = results[0];
  if (!first?.lat || !first?.lon) return null;

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

/**
 * Every venue in this league is within about twenty miles of Hertford —
 * the home page puts the league's area at Bishop's Stortford to Enfield.
 * A result outside this box is Nominatim having matched something else
 * with the same name, and is rejected rather than stored: a marker in
 * Cumbria is worse than no marker, because no marker is visibly missing
 * and a wrong one is not.
 */
const BOUNDS = { minLat: 51.4, maxLat: 52.2, minLng: -0.8, maxLng: 0.6 };

function withinLeagueArea(point: Point): boolean {
  return (
    point.latitude >= BOUNDS.minLat &&
    point.latitude <= BOUNDS.maxLat &&
    point.longitude >= BOUNDS.minLng &&
    point.longitude <= BOUNDS.maxLng
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  console.log(`Geocoding venues via Nominatim${force ? " (--force: re-doing every venue)" : ""}\n`);

  const client = await getSchemaClient();
  const venues = (await client.request(
    readItems("hrc_venues" as never, {
      fields: ["id", "name", "address_line_1", "address_line_2", "town", "postcode", "latitude", "longitude"],
      limit: -1,
    } as never),
  )) as Row[];

  let located = 0;
  let skipped = 0;
  const problems: string[] = [];

  for (const venue of venues) {
    const name = String(venue.name);

    if (!force && venue.latitude !== null && venue.longitude !== null) {
      skipped += 1;
      continue;
    }

    const candidates = candidatesFor(venue);
    if (candidates.length === 0) {
      problems.push(`${name}: no address or postcode to look up`);
      continue;
    }

    let point: Point | null = null;
    let usedLabel = "";
    for (const candidate of candidates) {
      await sleep(THROTTLE_MS);
      let result: Point | null;
      try {
        result = await lookup(candidate.query);
      } catch (error) {
        problems.push(`${name}: ${(error as Error).message}`);
        break;
      }
      if (!result) continue;
      if (!withinLeagueArea(result)) {
        problems.push(
          `${name}: "${candidate.query}" resolved to ${result.latitude}, ${result.longitude}, ` +
            "which is outside the league's area — ignored",
        );
        continue;
      }
      point = result;
      usedLabel = candidate.label;
      break;
    }

    if (!point) {
      problems.push(`${name}: nothing usable found`);
      continue;
    }

    await client.request(
      updateItem("hrc_venues" as never, venue.id, {
        latitude: point.latitude,
        longitude: point.longitude,
      } as never),
    );
    located += 1;
    console.log(
      `  = ${name}: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)} (by ${usedLabel})`,
    );
  }

  console.log(`\n  ${located} located, ${skipped} already had coordinates, ${venues.length} venues in all.`);

  if (problems.length > 0) {
    console.log("\n  ! problems:");
    for (const problem of problems) console.log(`    ${problem}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
