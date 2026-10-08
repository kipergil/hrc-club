import { readItems } from "@directus/sdk";
import { writeFileSync } from "node:fs";
import { getSchemaClient } from "./lib/client.js";
const c = await getSchemaClient();
const r = async (col: string, fields: unknown[]) => (await c.request(readItems(col as never, { fields, limit: -1 } as never))) as any[];
const snap = {
  teams: await r("hrc_teams", ["id", "name", "division", "is_active", "home_night", { captain: ["full_name"] }]),
  members: await r("hrc_members", ["id", "full_name", "status", { club: ["name"] }]),
  squads: await r("hrc_squads", ["id", { team: ["name"] }, { member: ["full_name"] }, "role"]),
  fixtures: await r("hrc_fixtures", ["id", "status", "home_score", "away_score", "played_on", "scorecard_url", { home_team: ["name"] }, { away_team: ["name"] }]),
  rubbers: await r("hrc_rubbers", ["id", "fixture"]),
  stats: await r("hrc_player_stats", ["id"]),
};
writeFileSync(process.argv[2]!, JSON.stringify(snap));
console.log(Object.fromEntries(Object.entries(snap).map(([k, v]) => [k, v.length])));
process.exit(0);
