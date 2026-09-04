import { env } from "../lib/env.js";
import type { PermissionRule, PolicyDefinition } from "./types.js";

/**
 * Collections the site only ever reads. Content in all of these is authored
 * in the Directus admin panel by the committee, never written through the
 * app's own API — so the service token has no reason to hold create,
 * update or delete on any of them.
 */
const READ_ONLY_COLLECTIONS = [
  "hrc_site_settings",
  "hrc_clubs",
  "hrc_pages",
  "hrc_news",
  "hrc_events",
  "hrc_sessions",
  "hrc_venues",
  "hrc_seasons",
  "hrc_teams",
  "hrc_squads",
  "hrc_honours",
  "hrc_membership_options",
  "hrc_committee_roles",
  "hrc_documents",
  "hrc_gallery_albums",
  "hrc_gallery_items",
  "hrc_sponsors",
  "hrc_links",
  "hrc_faqs",
];

/**
 * Written by the league sync job, which runs on a schedule with this same
 * token. Not `delete`: a fixture that vanishes upstream is marked `void`,
 * never removed, so a link to it never 404s.
 */
const SYNCED_COLLECTIONS = ["hrc_fixtures", "hrc_standings", "hrc_player_stats"];

/**
 * Written when a match card is entered or uploaded.
 *
 * Rubbers get `delete` as well, because saving a corrected card replaces
 * the match's rubbers wholesale rather than trying to reconcile ten rows
 * against ten rows — a half-updated card is a worse state than either the
 * old one or the new one.
 *
 * These grants say what the *server* may do, not who may ask it to. The
 * scorecard endpoints are behind an admin gate in Express; Directus has no
 * idea who is signed in, and a token that could not write here would make
 * the feature impossible rather than safer.
 */
const SCORECARD_COLLECTIONS = ["hrc_rubbers", "hrc_scorecards"];

/**
 * The public projection of a member. `email` and `phone` are absent by
 * design — this list, not a convention in application code, is what makes
 * a member's contact details unreachable through the app's token. A bug in
 * a route handler that selects `*` still cannot return them.
 */
const MEMBER_PUBLIC_FIELDS = [
  "id",
  "full_name",
  "display_name",
  "slug",
  "bio",
  "photo",
  "status",
  "joined_year",
  "show_on_site",
  "is_coach",
  "is_committee",
  // Readable because the site now holds every player in the league, and
  // "our players" is a filter on this column — Directus refuses to filter
  // on a field the policy cannot read.
  "club",
  "clerk_user_id",
  /*
   * Who may enter results, and the address they say so with.
   *
   * `result_entry_email` exists rather than reusing `email` precisely so
   * that this list can stay as it is: Directus refuses to filter on a
   * field the policy cannot read, so matching on the contact address
   * would mean granting read on every member's contact address. This way
   * the readable set is the handful of people who opted in to entering
   * results, and the other 165 members' details stay unreachable through
   * this token however a route handler is written.
   */
  "can_enter_results",
  "result_entry_email",
  "date_created",
  "date_updated",
];

const rules: PermissionRule[] = [
  ...READ_ONLY_COLLECTIONS.map((collection): PermissionRule => ({ collection, action: "read" })),

  ...SYNCED_COLLECTIONS.flatMap((collection): PermissionRule[] => [
    { collection, action: "read" },
    { collection, action: "create" },
    { collection, action: "update" },
  ]),

  ...SCORECARD_COLLECTIONS.flatMap((collection): PermissionRule[] => [
    { collection, action: "read" },
    { collection, action: "create" },
    { collection, action: "update" },
    { collection, action: "delete" },
  ]),

  // Members are readable only through the projection above, and updatable
  // only in the one column the sign-in flow sets — linking a Clerk identity
  // to an existing member row. Nothing else about a member can be changed
  // through the app.
  { collection: "hrc_members", action: "read", fields: MEMBER_PUBLIC_FIELDS },
  { collection: "hrc_members", action: "update", fields: ["clerk_user_id"] },

  // The one collection the public writes to. Create only: a visitor can
  // submit an enquiry and can never read one back, so the form cannot be
  // turned into a way of reading other people's messages.
  { collection: "hrc_enquiries", action: "create" },

  // Assets — logos, photos, documents — are served through the app rather
  // than linked directly, so read is enough. Uploads happen in the admin
  // panel.
  { collection: "directus_files", action: "read" },
  /*
   * Create, so an uploaded match card can be stored as the evidence
   * behind a result. Read is enough for everything else the site serves —
   * logos, photos, documents are all uploaded in the admin panel — and
   * there is deliberately no update or delete: a card that has been used
   * to settle a result should not be replaceable or removable through
   * the app's own token.
   */
  { collection: "directus_files", action: "create" },
];

/**
 * The single policy this project owns, used by the Express server's static
 * token. No admin access, no app access (no panel login), no schema, role
 * or policy access, and no reach outside `hrc_*` and `directus_files`.
 *
 * Named with the app prefix rather than something generic because this
 * Directus instance is shared: a policy simply called "Service" already
 * exists here and belongs to another project. Reusing that name would
 * overwrite its permissions instead of creating ours.
 */
export const servicePolicy: PolicyDefinition = {
  name: `${env.APP_NAME} Service`,
  icon: "dns",
  description: `${env.APP_NAME}'s server-side token. Never exposed to the browser.`,
  adminAccess: false,
  appAccess: false,
  role: { icon: "dns" },
  rules,
};

export const allPolicies: PolicyDefinition[] = [servicePolicy];
