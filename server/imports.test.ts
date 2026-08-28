import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Server code must not import through the `@shared` / `@` path aliases.
 *
 * This is not style. Vite rewrites those aliases when it bundles the
 * browser build, and Vitest resolves them too — so an aliased import in
 * `server/` typechecks, tests green, and builds clean. Nothing rewrites it
 * for the deployed serverless function, which Vercel compiles file by file
 * and runs as plain ESM: the specifier reaches Node as a bare package name
 * and every route in the function dies with ERR_MODULE_NOT_FOUND.
 *
 * That is exactly what happened, and nothing in the pipeline noticed —
 * which is why the check is a grep over the source rather than a runtime
 * assertion. It is the only place the constraint can be caught before a
 * deployment.
 */

const ALIAS = /from\s+["'](@\/|@shared\/)/;

async function tsFilesIn(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return tsFilesIn(full);
      return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [full] : [];
    }),
  );
  return files.flat();
}

describe("serverless-safe imports", () => {
  it("uses relative paths, not bundler aliases, everywhere the function runs", async () => {
    const root = path.resolve(import.meta.dirname, "..");
    const files = [
      ...(await tsFilesIn(path.join(root, "server"))),
      ...(await tsFilesIn(path.join(root, "api"))),
      ...(await tsFilesIn(path.join(root, "shared"))),
    ];

    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (ALIAS.test(source)) offenders.push(path.relative(root, file));
    }

    expect(offenders).toEqual([]);
  });
});
