/**
 * Parses the league's club page — `Clubz.asp?Club=HRC`.
 *
 * Pure: no network, no Directus, no side effects. That is deliberate. The
 * markup is Microsoft FrontPage output from a Classic ASP page nobody has
 * promised to keep stable and which is due to be rebuilt entirely, so it
 * needs real tests against a captured fixture — and a module that reaches
 * for admin credentials the moment it is imported cannot have those.
 */

export interface TeamInfo {
  name: string;
  division: string;
  homeNight: string;
  captain: string | null;
  players: string[];
}

export interface ClubInfo {
  venue: string;
  teams: TeamInfo[];
  updatedAt: string | null;
}

function stripTags(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)));
}

/** "Premier" / "Div One" / "Div Two" as the league writes them. */
function toDivision(label: string): string {
  const normalised = label.toLowerCase().replace(/[()]/g, "").trim();
  if (normalised.startsWith("prem")) return "premier";
  if (/one|1/.test(normalised)) return "division_1";
  if (/two|2/.test(normalised)) return "division_2";
  throw new Error(`Unrecognised division "${label}" — the league may have renamed its divisions.`);
}

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseClubPage(source: string): ClubInfo {
  const venueMatch = source.match(/Our Venue:\s*(?:<[^>]+>\s*)*([^<]+)/i);
  if (!venueMatch) throw new Error("Could not find 'Our Venue:' — the page layout has changed.");
  const venue = decodeEntities(venueMatch[1]!).replace(/\s+/g, " ").trim();

  // Each team is its own table cell. Parsing cell by cell rather than with
  // one regex over the whole section is what copes with the markup as it
  // actually is: the name and its division sit in separate <font> tags with
  // an `&nbsp;` between them, which no single pattern spans cleanly.
  const teamSection = source.slice(source.search(/Our Teams/i), source.search(/Our Players/i));
  const teams: TeamInfo[] = [];

  for (const cell of teamSection.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis)) {
    const block = cell[1]!;
    const text = stripTags(block);

    const nameMatch = text.match(/\b(HRC\s+[A-Z])\b/);
    const divisionMatch = text.match(/\(([^)]+)\)/);
    if (!nameMatch || !divisionMatch) continue;

    const name = nameMatch[1]!.replace(/\s+/g, " ");
    if (teams.some((team) => team.name === name)) continue;

    const nightMatch = text.match(/Home night:\s*([A-Za-z]+)/i);
    const contactMatch = text.match(/Contact:\s*(.+?)(?:\s*Email:|\s*Tel:|$)/i);

    teams.push({
      name,
      division: toDivision(divisionMatch[1]!),
      homeNight: (nightMatch?.[1] ?? "").toLowerCase(),
      captain: contactMatch ? contactMatch[1]!.trim() || null : null,
      players: [],
    });
  }

  if (teams.length === 0) throw new Error("Found no teams — the page layout has changed.");

  // The players table puts one team per column, interleaved with spacer
  // cells. Mapping by header index rather than by dropping the empties is
  // what keeps a squad attached to the right team.
  const playersSection = source.slice(source.search(/Our Players/i));
  const rows = [...playersSection.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis)].map((m) => m[1]!);
  if (rows.length < 2) throw new Error("Could not find the players table.");

  const cellsOf = (row: string) => [...row.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis)].map((m) => m[1]!);
  const header = cellsOf(rows[0]!);
  const body = cellsOf(rows[1]!);

  header.forEach((cell, index) => {
    const teamName = stripTags(cell);
    const team = teams.find((t) => t.name === teamName);
    if (!team) return;

    const names = (body[index] ?? "")
      .split(/<br[^>]*>/i)
      .map(stripTags)
      .filter(Boolean);

    // The league's own data lists at least one player twice; de-duplicate
    // rather than creating two rows for one person.
    team.players = [...new Set(names)];
  });

  const updated = source.match(/Club data last updated\s*([^<\n]+)/i);

  return { venue, teams, updatedAt: updated ? decodeEntities(updated[1]!).trim() : null };
}

/** Splits "Bushby Hall, 8 Wharf Road, Wormley, Herts. EN10 6HX" into fields. */
export function parseVenue(venue: string): {
  name: string;
  addressLine1: string | null;
  town: string | null;
  postcode: string | null;
} {
  const postcodeMatch = venue.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/i);
  const postcode = postcodeMatch ? postcodeMatch[1]!.toUpperCase().replace(/\s+/, " ") : null;
  const withoutPostcode = postcode ? venue.replace(postcodeMatch![0], "") : venue;
  const parts = withoutPostcode
    .split(",")
    .map((part) => part.trim().replace(/[.,]$/, ""))
    .filter(Boolean);

  return {
    name: parts[0] ?? venue,
    addressLine1: parts[1] ?? null,
    // The last remaining part is the county ("Herts"); the one before it is
    // the town, which is what a visitor actually needs.
    town: parts.length > 3 ? parts[parts.length - 2]! : (parts[2] ?? null),
    postcode,
  };
}

