import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The wait while a card is being read.
 *
 * Reading a photographed card takes twenty to forty seconds, and a long
 * one takes longer. The screen used to say "Reading the card…" on a button
 * and nothing else, which for half a minute is indistinguishable from a
 * screen that has stopped working — so people pressed the button again, or
 * gave up and decided the upload had been cancelled.
 *
 * Three things fix that, and none of them is a progress bar: there is no
 * honest percentage to show, and inventing one is worse than admitting it.
 *
 *  - Something moving, so the page is visibly alive.
 *  - Words that change, so it is visibly *still* alive.
 *  - After a while, an explicit "this is normal, it has not hung", because
 *    at forty seconds that is the actual question being asked.
 */

/**
 * Lines that turn over while the model reads the card.
 *
 * They are what the reading genuinely involves, told lightly — squinting
 * at biro, deciding whether a digit is a 4 or a 9, matching first names to
 * a squad. Light-hearted, but never a joke at the captain's expense and
 * never a claim about progress that is not being made: nothing here says a
 * percentage or a stage, because the wait has neither.
 */
export const READING_LINES = [
  "Squinting at the handwriting…",
  "Deciding whether that is a 4 or a 9…",
  "Counting to eleven. Twice…",
  "Matching first names to the squad…",
  "Reading the doubles, which is always the messy one…",
  "Checking nobody won a game 12-3…",
  "Adding up the sets…",
  "Working out whose 7 that is…",
  "Turning biro into numbers…",
  "Following the card down the printed order…",
] as const;

/** How long each line stays up. Long enough to read, short enough to notice. */
const LINE_MS = 3_500;

/** When the wait stops being ordinary and deserves saying so. */
const REASSURE_AFTER_MS = 40_000;

export function ReadingProgress({
  /** Overridable so a test can drive the rotation rather than wait on a clock. */
  intervalMs = LINE_MS,
  reassureAfterMs = REASSURE_AFTER_MS,
  className,
}: {
  intervalMs?: number;
  reassureAfterMs?: number;
  className?: string;
}) {
  /*
   * A random starting point, so entering twenty cards in an evening is not
   * twenty identical performances of the same first line.
   */
  const [index, setIndex] = useState(() => Math.floor(Math.random() * READING_LINES.length));
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const rotate = setInterval(() => {
      setIndex((current) => (current + 1) % READING_LINES.length);
    }, intervalMs);
    const reassure = setTimeout(() => setSlow(true), reassureAfterMs);
    return () => {
      clearInterval(rotate);
      clearTimeout(reassure);
    };
  }, [intervalMs, reassureAfterMs]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-card border border-brand/30 bg-brand-soft p-4",
        className,
      )}
    >
      {/*
        `animate-spin` is switched off by the site's reduced-motion rule,
        which is why the rotating line below carries the same message. The
        spinner is the fast signal for people who want one, not the only
        signal.
      */}
      <Loader2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 animate-spin text-brand" />

      <div className="min-w-0">
        {/*
          One calm sentence in the live region, announced once. The rotating
          line is decorative: a screen reader that read out a new joke every
          three and a half seconds would be actively worse than silence.
        */}
        <p role="status" className="font-semibold text-ink">
          Reading the card. This usually takes about half a minute.
        </p>
        <p aria-hidden="true" className="mt-1 text-ink-muted">
          {READING_LINES[index]}
        </p>
        {slow ? (
          <p className="mt-2 text-ink-muted">
            Still going. A busy card or a slow connection can take a couple of minutes — nothing has
            gone wrong, and nothing is saved until you check it.
          </p>
        ) : null}
      </div>
    </div>
  );
}
