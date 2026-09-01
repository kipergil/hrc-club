import { Link } from "wouter";
import type { FixtureDetail, Rubber, RubberPlayer } from "@shared/types.js";
import { DOUBLES_RUBBER, slotsForRubber } from "@shared/scorecard.js";
import { Badge, Empty, TableNote, TableScroller, Td, Th, Tr } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * The match card, laid out the way the league's own sheet is.
 *
 * `SingleScoreCard.htm` prints nine singles in a fixed order — A-X, B-Y,
 * C-Z, B-X, A-Z, C-Y, B-Z, C-X, A-Y — then the doubles, with five columns
 * for the games and a SETS column at the end. Following that ordering
 * exactly is not decoration: a captain checking this page against the
 * paper in their hand should be reading the same rows in the same order,
 * and any rearrangement makes that comparison a puzzle.
 *
 * Both sides are named on every row. That is a property of the data now —
 * a rubber holds home and away players rather than "our player" and a
 * string — so nothing here has to know which team the reader supports.
 */

function PlayerNames({ players }: { players: RubberPlayer[] }) {
  if (players.length === 0) return <span className="text-ink-muted">—</span>;
  return (
    <>
      {players.map((player, index) => (
        <span key={`${player.name}-${index}`}>
          {index > 0 ? <span className="text-ink-muted"> &amp; </span> : null}
          {player.slug ? (
            <Link href={`/players/${player.slug}`} className="link">
              {player.name}
            </Link>
          ) : (
            player.name
          )}
        </span>
      ))}
    </>
  );
}

/**
 * The games of one rubber, home points first.
 *
 * Written as the card writes them — "11-8, 9-11, 11-6" — rather than as a
 * table of five columns, because a rubber is usually three games and a
 * five-column grid would be mostly empty on every row.
 */
function Games({ games }: { games: Rubber["games"] }) {
  if (games.length === 0) return null;
  return (
    <span className="block text-ink-muted">
      {games.map(([home, away], index) => (
        <span key={index}>
          {index > 0 ? ", " : ""}
          {home}–{away}
        </span>
      ))}
    </span>
  );
}

function rubberLabel(rubber: Rubber): string {
  if (rubber.rubberNumber === DOUBLES_RUBBER || rubber.kind === "doubles") return "Doubles";
  const slots = slotsForRubber(rubber.rubberNumber);
  // The card's own labels, so a row here and a row on the paper are
  // obviously the same row.
  return slots ? `${slots[0]} v ${slots[1]}` : String(rubber.rubberNumber);
}

export function Scorecard({ match }: { match: FixtureDetail }) {
  const rubbers = [...match.rubbers].sort((a, b) => a.rubberNumber - b.rubberNumber);

  if (rubbers.length === 0) {
    return (
      <section aria-labelledby="card-heading">
        <h2 id="card-heading" className="mb-3 text-2xl">
          The card
        </h2>
        <Empty>
          {match.status === "played"
            ? "The result is in, but the card itself has not been entered yet."
            : "This match has not been played yet."}
        </Empty>
      </section>
    );
  }

  /*
   * The score after each rubber, which is how a match is actually
   * followed on the night — "we were 4-3 up going into the doubles". It
   * is derived here rather than stored, because it is a property of the
   * order the rubbers are read in and nothing else.
   */
  let home = 0;
  let away = 0;
  const running = rubbers.map((rubber) => {
    if (rubber.homeSets > rubber.awaySets) home += 1;
    else if (rubber.awaySets > rubber.homeSets) away += 1;
    return { home, away };
  });

  return (
    <section aria-labelledby="card-heading">
      <h2 id="card-heading" className="mb-3 text-2xl">
        The card
      </h2>
      <TableNote>
        Each line is one rubber — best of five games, 11 up. The order is the league card's own:
        nine singles, then the doubles. Game scores read {match.homeTeam.name} first.
      </TableNote>

      <div className="hidden sm:block">
        <TableScroller>
          <thead>
            <tr>
              <Th className="w-20">Rubber</Th>
              <Th>{match.homeTeam.name}</Th>
              <Th>{match.awayTeam.name}</Th>
              <Th className="text-right">Sets</Th>
              <Th className="text-right">Score</Th>
            </tr>
          </thead>
          <tbody>
            {rubbers.map((rubber, index) => {
              const homeWon = rubber.homeSets > rubber.awaySets;
              const awayWon = rubber.awaySets > rubber.homeSets;
              const isDoubles = rubber.kind === "doubles";
              return (
                <Tr key={rubber.id} highlight={isDoubles}>
                  <Td className="whitespace-nowrap text-ink-muted">
                    <span className="tabular">{rubber.rubberNumber}.</span>{" "}
                    <span className={cn(isDoubles && "font-semibold text-ink")}>
                      {rubberLabel(rubber)}
                    </span>
                  </Td>
                  <Td className={cn(homeWon && "font-semibold")}>
                    <PlayerNames players={rubber.home} />
                  </Td>
                  <Td className={cn(awayWon && "font-semibold")}>
                    <PlayerNames players={rubber.away} />
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <span className="tabular font-semibold">
                      {rubber.homeSets}–{rubber.awaySets}
                    </span>
                    <Games games={rubber.games} />
                  </Td>
                  {/* The match score as it stood after this rubber. */}
                  <Td className="tabular text-right text-ink-muted">
                    {running[index]!.home}–{running[index]!.away}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </TableScroller>
      </div>

      {/*
        On a phone the five-column table is unreadable, so each rubber
        becomes a block. Same information, same order, no sideways scroll.
      */}
      <ol className="space-y-3 sm:hidden">
        {rubbers.map((rubber, index) => {
          const homeWon = rubber.homeSets > rubber.awaySets;
          return (
            <li
              key={rubber.id}
              className={cn(
                "rounded-card border border-line bg-surface p-4 shadow-card",
                rubber.kind === "doubles" && "border-brand bg-brand-soft",
              )}
            >
              <p className="flex items-baseline justify-between gap-3 text-ink-muted">
                <span>
                  <span className="tabular">{rubber.rubberNumber}.</span> {rubberLabel(rubber)}
                </span>
                <span className="tabular">
                  {running[index]!.home}–{running[index]!.away}
                </span>
              </p>
              <p className={cn("mt-1", homeWon && "font-semibold")}>
                <PlayerNames players={rubber.home} />
              </p>
              <p className={cn(!homeWon && "font-semibold")}>
                <PlayerNames players={rubber.away} />
              </p>
              <p className="mt-2 tabular">
                <span className="text-lg font-semibold">
                  {rubber.homeSets}–{rubber.awaySets}
                </span>
                <Games games={rubber.games} />
              </p>
            </li>
          );
        })}
      </ol>

      {/*
        The card is out of ten. Saying so, and saying what it adds up to,
        is the check a reader can do themselves — and the one that catches
        a card entered with a rubber missing.
      */}
      <p className="mt-4 flex flex-wrap items-center gap-3">
        <Badge tone="neutral">
          {rubbers.length} of 10 rubbers · {home}–{away}
        </Badge>
        {match.homeScore !== null &&
        match.awayScore !== null &&
        (match.homeScore !== home || match.awayScore !== away) ? (
          // Loud, because it means the card and the recorded result
          // disagree and one of them is wrong.
          <Badge tone="negative">
            The recorded result is {match.homeScore}–{match.awayScore}, which this card does not add
            up to.
          </Badge>
        ) : null}
      </p>
    </section>
  );
}
