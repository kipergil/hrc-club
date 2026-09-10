import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createItems, readFiles, readItems, updateFile, updateItem, uploadFiles } from "@directus/sdk";
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
 *
 * Screenshots travel with the post. A post declares them by name, the file
 * sits next to this script under `__images__/`, and `image:token` in the
 * body is swapped for the real address on the way out — see `resolveImages`
 * below for why they are uploaded rather than referenced from the repo.
 */

type Row = { id: string | number; slug: string };
type FileRow = { id: string; title?: string | null };

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Uploads a post's screenshots and returns its body with the tokens
 * replaced.
 *
 * The images go into Directus rather than being served from the client
 * bundle because that is where the rest of the site's images already live,
 * and `/api/files/:id` is the one image address the content security
 * policy admits — a post pointing anywhere else renders a broken image and
 * no error.
 *
 * Matched on `title`, which is set to the filename, so a re-run replaces
 * the picture instead of filling the library with copies of it. That
 * matters: these are screenshots of a screen that will change.
 */
async function resolveImages(
  client: Awaited<ReturnType<typeof getSchemaClient>>,
  images: Record<string, string> | undefined,
  body: string,
): Promise<string> {
  if (!images) return body;

  let resolved = body;
  for (const [token, filename] of Object.entries(images)) {
    const bytes = readFileSync(path.join(here, "__images__", filename));

    // `readFiles`, not `readItems` — the SDK refuses core collections
    // through the generic item commands.
    const existing = (await client.request(
      readFiles({
        fields: ["id", "title"],
        filter: { title: { _eq: filename } },
        limit: 1,
      } as never),
    )) as FileRow[];

    const form = new FormData();
    form.append("title", filename);
    form.append("file", new Blob([bytes], { type: "image/png" }), filename);

    // `updateFile` replaces the bytes behind an id; `uploadFiles`' second
    // argument is a query, not a key, so passing the id there builds a
    // nonsense request rather than replacing anything.
    const id = existing[0]?.id;
    const file = (await client.request(
      id ? updateFile(id, form) : uploadFiles(form),
    )) as FileRow;

    console.log(`      ${id ? "=" : "+"} ${filename} → ${file.id}`);
    resolved = resolved.split(`image:${token}`).join(`/api/files/${file.id}`);
  }

  // A token left behind is a broken image on a published page, and the
  // markdown renders it as an empty box rather than as an error.
  const orphan = resolved.match(/image:[a-z0-9_-]+/i);
  if (orphan) {
    throw new Error(`No image declared for "${orphan[0]}" — check the post's images map.`);
  }
  return resolved;
}

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
      body: await resolveImages(client, post.images, post.body),
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
