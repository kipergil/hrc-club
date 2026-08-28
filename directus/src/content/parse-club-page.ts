/**
 * Parses a league club page — `Clubz.asp?Club=<name>`.
 *
 * Pure: no network, no Directus, no side effects. That is deliberate. The
 * markup is Microsoft FrontPage output from a Classic ASP page nobody has
 * promised to keep stable and which is due to be rebuilt entirely, so it
 * needs real tests against captured fixtures — and a module that reaches
 * for admin credentials the moment it is imported cannot have those.
 *
 * The ten club pages are not uniform, and the differences are the whole
 * difficulty:
 *
 *  - A club with one team heads its section "Our Team:", not "Our Teams:",
 *    and names that team after the club with no letter — "Kidston", not
 *    "Kidston A". Three of the ten are like this, and matching only the
 *    plural silently yields a club with no teams at all.
 *  - Team names carry no fixed prefix: "Water Lane C", "St. Andrews B",
 *    "PramaStars A". The name is whatever precedes the division bracket.
 *  - The players table interleaves spacer cells between team columns, so a
 *    squad has to be matched to its team by header index. Dropping the
 *    empties instead shifts every squad one team to the left, which parses
 *    perfectly cleanly and is completely wrong.
 */

export interface TeamInfo {
  name: string;
  division: string;
  homeNight: string;
  captain: string | null;
  players: string[];
}

export interface ClubInfo {
  clubName: string | null;
  venue: string | null;
  teams: TeamInfo[];
  updatedAt: string | null;
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

export function stripTags(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

/** "Premier" / "Div One" / "Div Two" as the league writes them. */
export function toDivision(label: string): string {
  const normalised = label.toLowerCase().replace(/[()]/g, "").trim();
  if (normalised.startsWith("prem")) return "premier";
  if (/\bone\b|\b1\b/.test(normalised)) return "division_1";
  if (/\btwo\b|\b2\b/.test(normalised)) return "division_2";
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

function cellsOf(row: string): string[] {
  return [...row.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis)].map((m) => m[1]!);
}

export function parseClubPage(source: string): ClubInfo {
  // Singular for a one-team club, plural for the rest.
  const teamsHeading = source.search(/Our\s+Teams?\s*:/i);
  const playersHeading = source.search(/Our\s+Players?\s*:/i);
  if (teamsHeading < 0 || playersHeading < 0) {
    throw new Error("Not a club page — no 'Our Team(s)' and 'Our Players' headings.");
  }

  const nameMatch = source.match(/<title[^>]*>\s*([^<]*?)\s*(?:Homepage|Home\s*page)?\s*<\/title>/i);
  const headingMatch = stripTags(source.slice(0, teamsHeading)).match(/^(.*?)\s+Homepage\b/i);
  const clubName = (headingMatch?.[1] ?? nameMatch?.[1] ?? "").trim() || null;

  const venueMatch = source.match(/Our Venue:\s*(?:<[^>]+>\s*)*([^<]+)/i);
  const venueRaw = venueMatch ? decodeEntities(venueMatch[1]!).replace(/\s+/g, " ").trim() : null;
  // A club with no hall recorded says so in as many words.
  const venue = venueRaw && !/^unknown$/i.test(venueRaw) ? venueRaw : null;

  // Each team is its own table cell. Parsing cell by cell rather than with
  // one regex over the whole section is what copes with the markup as it
  // actually is: the name and its division sit in separate <font> tags with
  // an `&nbsp;` between them, which no single pattern spans cleanly.
  const teamSection = source.slice(teamsHeading, playersHeading);
  const teams: TeamInfo[] = [];

  for (const cell of cellsOf(teamSection)) {
    const text = stripTags(cell);
    // The team's name is whatever precedes the division bracket — there is
    // no prefix to match on, and a one-team club's name has no letter.
    const match = text.match(/^(.+?)\s*\(([^)]+)\)/);
    if (!match) continue;

    const name = match[1]!.replace(/\s+/g, " ").trim();
    if (!name || teams.some((team) => team.name === name)) continue;

    const night = text.match(/Home night:\s*([A-Za-z]+)/i);
    const contact = text.match(/Contact:\s*(.+?)(?:\s*Email:|\s*Tel:|$)/i);

    teams.push({
      name,
      division: toDivision(match[2]!),
      homeNight: (night?.[1] ?? "").toLowerCase(),
      captain: contact ? contact[1]!.trim() || null : null,
      players: [],
    });
  }

  if (teams.length === 0) throw new Error("Found no teams — the page layout has changed.");

  const playersSection = source.slice(playersHeading);
  const rows = [...playersSection.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis)].map((m) => m[1]!);
  if (rows.length >= 2) {
    const header = cellsOf(rows[0]!);
    const body = cellsOf(rows[1]!);

    header.forEach((cell, index) => {
      const heading = stripTags(cell);
      const team = teams.find((t) => t.name === heading);
      if (!team) return;

      const names = (body[index] ?? "")
        .split(/<br[^>]*>/i)
        .map(stripTags)
        .filter(Boolean);

      // The league's own data lists at least one player twice; de-duplicate
      // rather than creating two rows for one person.
      team.players = [...new Set(names)];
    });

    // A one-team club has no header row naming the team — the single column
    // is simply the squad.
    if (teams.length === 1 && teams[0]!.players.length === 0) {
      const onlyCell = body.find((cell) => stripTags(cell).length > 0);
      if (onlyCell) {
        teams[0]!.players = [
          ...new Set(
            onlyCell
              .split(/<br[^>]*>/i)
              .map(stripTags)
              .filter((name) => name && name !== teams[0]!.name),
          ),
        ];
      }
    }
  }

  const updated = source.match(/Club data last updated\s*([^<\n]+)/i);
  const updatedAt = updated ? decodeEntities(updated[1]!).trim() : null;

  return {
    clubName,
    venue,
    teams,
    // The league stamps a placeholder date on a club it holds no data for.
    updatedAt: updatedAt && !updatedAt.startsWith("30 Dec 1899") ? updatedAt : null,
  };
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

  // The last part is often the county ("Herts"), which is no use to someone
  // driving there; the town is the part before it. Where there is no county,
  // the last part is the town.
  const isCounty = (value: string | undefined) => !!value && /^herts?(fordshire)?$/i.test(value);
  let town: string | null = null;
  if (parts.length >= 3) {
    town = isCounty(parts[parts.length - 1]) ? (parts[parts.length - 2] ?? null) : (parts[parts.length - 1] ?? null);
  } else if (parts.length === 2) {
    town = parts[1] ?? null;
  }

  return {
    name: parts[0] ?? venue,
    addressLine1: parts.length > 1 ? (parts[1] ?? null) : null,
    town,
    postcode,
  };
}

/**
 * Finds every club the league links to, from any page carrying its
 * navigation.
 *
 * Discovered rather than hard-coded so a club joining or leaving the league
 * is picked up by the next import. Only `href` attributes are read: the
 * same identifiers appear elsewhere in the page as bare text, where a name
 * containing a space ("Water Lane") is cut short at the space and would
 * import as a club called "Water".
 */
export function discoverClubRefs(source: string): string[] {
  const refs = new Set<string>();
  for (const match of source.matchAll(/href\s*=\s*["']([^"']*Clubz\.asp\?Club=[^"']*)["']/gi)) {
    const ref = decodeEntities(match[1]!.split("Club=", 2)[1] ?? "").trim();
    if (ref) refs.add(ref);
  }
  return [...refs].sort((a, b) => a.localeCompare(b));
}
