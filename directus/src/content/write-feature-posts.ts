import { createItems, readItems, updateItem } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { FEATURE_POSTS } from "./feature-posts.js";

/**
 * Publishes the feature posts into `hrc_news`.
 *
 * Upserts on the slug, so running it twice does not produce twenty posts,
 * and editing the text in `feature-posts.ts` and re-running updates what
 * is published rather than adding to it. That is the point of keeping the
 * words in the repository: the post and the feature it describes are
 * changed in the same commit.
 *
 * `published_at` is stamped in array order, a minute apart, descending —
 * the news list sorts on it, so the top of the array is the top of the
 * page. Existing posts keep the timestamp they were first given, because
 * re-running this to fix a typo should not reshuffle the page.
 *
 * Nothing is pinned. Pinning puts an item on the home page, which is for
 * the committee's notices, not for the site talking about itself.
 */

type Row = { id: string | number; slug: string };

async function main(): Promise<void> {
  const client = await getSchemaClient();

  const existing = (await client.request(
    readItems("hrc_news" as never, {
      fields: ["id", "slug"],
      filter: { slug: { _in: FEATURE_POSTS.map((post) => post.slug) } },
      limit: -1,
    } as never),
  )) as Row[];
  const bySlug = new Map(existing.map((row) => [row.slug, row.id]));

  const start = Date.now();
  let created = 0;
  let updated = 0;

  for (const [index, post] of FEATURE_POSTS.entries()) {
    const payload: Record<string, unknown> = {
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      body: post.body,
      category: "feature",
      status: "published",
      is_pinned: false,
    };

    const id = bySlug.get(post.slug);
    if (id === undefined) {
      // Newest first: the head of the array gets the latest stamp.
      payload.published_at = new Date(start - index * 60_000).toISOString();
      await client.request(createItems("hrc_news" as never, [payload] as never));
      created += 1;
    } else {
      await client.request(updateItem("hrc_news" as never, id, payload as never));
      updated += 1;
    }
    console.log(`  ${id === undefined ? "+" : "="} ${post.slug}`);
  }

  console.log(`\nFeature posts: ${created} created, ${updated} updated.`);
}

/*
 * The explicit exit is not optional: the authenticated client keeps a
 * token-refresh timer alive, so the process finishes its work and then
 * sits there. Every other script in this directory ends the same way.
 */
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
