import { createItems, deleteItems, readItems, readSingleton, updateItem, updateSingleton } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { env } from "../lib/env.js";
import { toSlug } from "./parse-club-page.js";
import {
  extractLinks,
  isTeamCompetition,
  parseHallOfFame,
  parseHomePage,
  parseRollOfHonour,
  type LeagueLink,
} from "./parse-league-pages.js";

/**
 * Imports the league's own content: the standing description of itself, the
 * committee, the notice at the top of the home page, the forms and
 * documents, the outward links, and the honours — every seasonal Roll of
 * Honour the site still links, plus the Hall of Fame, which runs back to
 * 1950.
 *
 * The honours are the reason this exists. The site audit calls them "the
 * single most valuable and least replaceable asset on the site": 686
 * results across 20 competitions, most of them recorded nowhere else. A
 * rebuild that lost them would be a worse site than the one it replaced,
 * however much better it looked.
 *
 * Documents are pulled into Directus rather than linked back to the old
 * site, so they survive it being switched off. Directus fetches each URL
 * itself, which is why there is no file handling here.
 */

const BASE = "http://hertsttl.org.uk";
const HOME = `${BASE}/Home.htm`;
const LINKS = `${BASE}/Links.htm`;
const HALL_OF_FAME = `${BASE}/HallOfFame2025.htm`;
const FIRST_ROLL_OF_HONOUR = "RollofHonour2025-26.htm";

type Row = Record<string, any>;
type Client = Awaited<ReturnType<typeof getSchemaClient>>;

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return new TextDecoder("windows-1252").decode(await response.arrayBuffer());
}

async function replaceAll(client: Client, collection: string, rows: Row[]): Promise<number> {
  const existing = (await client.request(
    readItems(collection as never, { fields: ["id"], limit: -1 } as never),
  )) as Row[];
  if (existing.length > 0) {
    await client.request(deleteItems(collection as never, existing.map((r) => r.id) as never));
  }
  // Directus is happy with a batch; 700 individual round trips is not a
  // reasonable way to spend four minutes.
  for (let i = 0; i < rows.length; i += 100) {
    await client.request(createItems(collection as never, rows.slice(i, i + 100) as never));
  }
  return rows.length;
}

/** Which of the league's document categories a form or PDF belongs to. */
function categorise(label: string, url: string): string {
  const text = `${label} ${url}`.toLowerCase();
  if (text.includes("constitution")) return "constitution";
  if (text.includes("handbook")) return "handbook";
  if (text.includes("minutes")) return "minutes";
  if (/form|scorecard|scoresheet|tt001/.test(text)) return "forms";
  return "other";
}

function absolute(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${BASE}/${url.replace(/^\.?\//, "")}`;
}

/**
 * Asks Directus to fetch the file itself. Returns null rather than throwing:
 * one missing form on a site full of dead links should not stop the import,
 * and the row still carries `external_url` so the document is reachable
 * either way.
 */
async function importFile(url: string, title: string): Promise<string | null> {
  try {
    const response = await fetch(`${env.DIRECTUS_URL}/files/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await currentToken()}`,
      },
      body: JSON.stringify({ url, data: { title } }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: { id?: string } };
    return body.data?.id ?? null;
  } catch {
    return null;
  }
}

let cachedToken: string | null = null;
async function currentToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const response = await fetch(`${env.DIRECTUS_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
  });
  const body = (await response.json()) as { data?: { access_token?: string } };
  cachedToken = body.data?.access_token ?? "";
  return cachedToken;
}

async function main(): Promise<void> {
  console.log(`Importing league content from ${BASE}\n`);

  const [homeSource, linksSource, hallOfFameSource] = await Promise.all([
    fetchPage(HOME),
    fetchPage(LINKS).catch(() => ""),
    fetchPage(HALL_OF_FAME).catch(() => ""),
  ]);

  const home = parseHomePage(homeSource);
  const client = await getSchemaClient();

  // -- The league's description of itself ----------------------------------

  const settings = (await client.request(readSingleton("hrc_site_settings" as never))) as Row;
  const announcement = [home.announcement, home.welcome].filter(Boolean).join("\n\n") || null;

  await client.request(
    updateSingleton("hrc_site_settings" as never, {
      club_name: "Hertford & District Table Tennis League",
      short_name: "Herts TTL",
      strapline: "Table tennis in Hertford and district since 1936",
      founded_year: 1936,
      about_summary: home.about,
      announcement,
      league_url: BASE,
      current_season: settings?.current_season ?? null,
    } as never),
  );
  console.log("  ~ site settings — name, description, and the notice from the home page");

  // -- Committee ------------------------------------------------------------

  /*
   * The role and the person go in separate fields.
   *
   * They used to be concatenated into `role_title` ("Chairperson — Jo
   * Swain") because there was nowhere else to put the name. That left the
   * `member` relation null, and the committee page reads a null member as
   * a vacancy — so every filled post on the page carried the holder's name
   * and the words "Vacant — could this be you?" underneath it.
   */
  const committee = home.committee.map((member, index) => ({
    role_title: member.role ?? "Committee member",
    holder_name: member.name,
    responsibilities: null,
    // The league publishes names but no addresses; feedback goes through its
    // own form, so nothing here invents an email.
    public_email: null,
    is_active: true,
    sort: index,
  }));
  console.log(`  = committee: ${await replaceAll(client, "hrc_committee_roles", committee)} members`);

  // -- Forms and documents --------------------------------------------------

  const documents: Row[] = [];
  for (const [index, link] of home.documents.entries()) {
    const url = absolute(link.url);
    const title = link.label.replace(/\s*\((PDF|DOC)\)\s*$/i, "").trim() || link.url;
    const fileId = await importFile(url, title);
    documents.push({
      title: link.label,
      slug: `${toSlug(title)}-${toSlug(link.url.replace(/\.[a-z]+$/i, ""))}`.slice(0, 110),
      category: categorise(link.label, link.url),
      description: null,
      file: fileId,
      external_url: fileId ? null : url,
      is_public: true,
      sort: index,
    });
  }
  const hosted = documents.filter((d) => d.file).length;
  console.log(
    `  = documents: ${await replaceAll(client, "hrc_documents", documents)} (${hosted} copied into Directus, ${documents.length - hosted} linked)`,
  );

  // -- Outward links --------------------------------------------------------

  const seen = new Set<string>();
  const linkRows: Row[] = [];
  const candidates: LeagueLink[] = [
    ...(linksSource ? extractLinks(linksSource) : []),
    ...home.externalLinks,
  ];
  for (const link of candidates) {
    // The old site has a few links written with backslashes, which no
    // browser resolves; they duplicate a working one alongside.
    const url = link.url.replace(/\\/g, "/").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const key = url.replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const label = link.label || url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
    linkRows.push({
      label,
      url,
      category: /tabletennisengland|sport80/i.test(url)
        ? "Table Tennis England"
        : /academy|coaching|btta/i.test(`${label} ${url}`)
          ? "Coaching"
          : "Equipment and suppliers",
      description: null,
      is_active: true,
      sort: linkRows.length,
    });
  }
  console.log(`  = links: ${await replaceAll(client, "hrc_links", linkRows)}`);

  // -- Honours --------------------------------------------------------------
  //
  // Rebuilt wholesale rather than reconciled: every row is derived from the
  // league's pages, so there is nothing here a re-import could lose.

  const honours: Row[] = [];

  // The seasonal rolls, walked backwards through the "previous season" link
  // each one carries.
  let next: string | null = FIRST_ROLL_OF_HONOUR;
  const visited = new Set<string>();
  while (next && !visited.has(next)) {
    visited.add(next);
    let source: string;
    try {
      source = await fetchPage(`${BASE}/${next}`);
    } catch {
      break;
    }
    /*
     * The page heading reads "2025 Roll of Honour" — a single year — while
     * the filename carries the full season. The season is the truthful
     * label, and it is also what separates these entries from the Hall of
     * Fame's single years when the site groups them: without it every
     * seasonal roll silently joins the historic pile.
     */
    const fromFilename = next.match(/(\d{4}-\d{2})/)?.[1];
    const roll = parseRollOfHonour(source, fromFilename);
    const seasonLabel = fromFilename ?? roll.seasonLabel;
    for (const entry of roll.entries) {
      honours.push({
        title: entry.runnerUp ? `${entry.competition} winners` : entry.competition,
        competition_name: entry.competition,
        honour_type: isTeamCompetition(entry.competition) ? "team" : "individual",
        season_label: seasonLabel,
        recipient_name: entry.winner,
        notes: entry.runnerUp ? `Runner-up: ${entry.runnerUp}` : null,
        sort: 0,
      });
    }
    const previous = extractLinks(source).find((link) => /RollOfHonour/i.test(link.url));
    next = previous && !visited.has(previous.url) ? previous.url : null;
  }
  console.log(`  = ${visited.size} seasonal Rolls of Honour`);

  // The Hall of Fame — one row per competition per year, back to 1950.
  if (hallOfFameSource) {
    for (const entry of parseHallOfFame(hallOfFameSource)) {
      honours.push({
        title: entry.competition,
        competition_name: entry.competition,
        honour_type: isTeamCompetition(entry.competition) ? "team" : "individual",
        season_label: String(entry.year),
        recipient_name: entry.winner,
        notes: null,
        sort: 0,
      });
    }
  }

  console.log(`  = honours: ${await replaceAll(client, "hrc_honours", honours)} rows`);

  // -- The webmaster's seasonal note ----------------------------------------

  if (home.welcome) {
    const existing = (await client.request(
      readItems("hrc_news" as never, {
        fields: ["id"],
        filter: { slug: { _eq: "season-notice" } },
        limit: 1,
      } as never),
    )) as Row[];
    const payload = {
      title: "Notice from the webmaster",
      slug: "season-notice",
      summary: home.welcome.slice(0, 280),
      body: [home.welcome, home.lastUpdated ? `\n\n*League site last updated ${home.lastUpdated}.*` : ""]
        .join("")
        .trim(),
      category: "notice",
      status: "published",
      is_pinned: true,
      published_at: new Date().toISOString(),
    };
    if (existing[0]) {
      await client.request(updateItem("hrc_news" as never, existing[0].id, payload as never));
    } else {
      await client.request(createItems("hrc_news" as never, [payload] as never));
    }
    console.log("  = the webmaster's seasonal notice");
  }

  console.log("\nLeague content import complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
