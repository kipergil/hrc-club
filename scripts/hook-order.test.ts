import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No component may call a hook after an early return.
 *
 * This is React's first rule, and breaking it does not produce a subtle
 * bug — it blanks the page. `FixturesPage` called `usePagination` below
 * its `isLoading` and `isError` guards, so the loading render called
 * fewer hooks than the loaded one and React threw "Rendered more hooks
 * than during the previous render", tearing down the whole route: no
 * rows, no empty state, no error message, nothing.
 *
 * What made it expensive was that it *usually worked*. Every page on this
 * site is prerendered with its data embedded, so on a normal visit the
 * first render is already a loaded one and the hook counts match. It
 * failed only where the query genuinely had to load — a cold client-side
 * navigation — which is exactly the "sometimes" in the bug report, and
 * exactly the case a screenshot of the working page does not cover.
 *
 * A scan rather than a test per component: the failure is structural, and
 * the next person to add a guard above a hook will not think to write a
 * test for it.
 */

const HOOK = /\b(use[A-Z]\w*)\s*\(/;
const EARLY_RETURN = /^\s{2}if\s*\(.*\)\s*return\b/;
const FUNCTION_START = /^(?:export\s+)?function\s+(\w+)/;
/** A hook assigned at the top level of a component body. */
const TOP_LEVEL_HOOK = /^\s{2}(?:const|let)\s.*=\s*(?:await\s+)?use[A-Z]/;

function tsxFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...tsxFiles(full));
    else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) found.push(full);
  }
  return found;
}

export interface Offence {
  file: string;
  line: number;
  component: string;
  hook: string;
  returnedAt: number;
}

/** Every hook call that sits below an early return in the same component. */
export function findConditionalHooks(source: string, file = "<source>"): Offence[] {
  const offences: Offence[] = [];
  const lines = source.split("\n");

  let component: string | null = null;
  let earlyReturn: number | null = null;

  for (const [index, line] of lines.entries()) {
    const start = FUNCTION_START.exec(line);
    if (start) {
      component = start[1]!;
      earlyReturn = null;
      continue;
    }
    // A closing brace in column zero ends the component.
    if (/^}/.test(line)) {
      component = null;
      earlyReturn = null;
      continue;
    }
    if (!component) continue;

    if (EARLY_RETURN.test(line)) {
      earlyReturn ??= index + 1;
      continue;
    }

    if (earlyReturn !== null && TOP_LEVEL_HOOK.test(line)) {
      offences.push({
        file,
        line: index + 1,
        component,
        hook: HOOK.exec(line)?.[1] ?? "use…",
        returnedAt: earlyReturn,
      });
    }
  }

  return offences;
}

describe("findConditionalHooks", () => {
  it("catches the shape that blanked the fixtures page", () => {
    const offences = findConditionalHooks(`
export function FixturesPage() {
  const { data, isLoading } = useFixtures("status=scheduled");

  if (isLoading) return <Loading />;

  const paged = usePagination(data, 4);
  return <div>{paged.items.length}</div>;
}
`);
    expect(offences).toHaveLength(1);
    expect(offences[0]).toMatchObject({ component: "FixturesPage", hook: "usePagination" });
  });

  it("allows every hook before the guards, which is the fix", () => {
    expect(
      findConditionalHooks(`
export function FixturesPage() {
  const { data, isLoading } = useFixtures("status=scheduled");
  const paged = usePagination(data, 4);

  if (isLoading) return <Loading />;

  return <div>{paged.items.length}</div>;
}
`),
    ).toEqual([]);
  });

  it("does not blame the next component for the previous one's return", () => {
    expect(
      findConditionalHooks(`
function First() {
  if (true) return null;
}

function Second() {
  const value = useMemo(() => 1, []);
  return value;
}
`),
    ).toEqual([]);
  });
});

describe("every component in the client", () => {
  it("calls all of its hooks before any early return", () => {
    const offences = tsxFiles("client/src").flatMap((file) =>
      findConditionalHooks(readFileSync(file, "utf8"), file),
    );

    expect(
      offences,
      offences
        .map(
          (o) =>
            `${o.file}:${o.line} — ${o.component} calls ${o.hook}() after the early return on line ${o.returnedAt}. ` +
            `Move every hook above the guards; React blanks the whole route otherwise.`,
        )
        .join("\n"),
    ).toEqual([]);
  });
});
