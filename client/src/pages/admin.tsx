import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Upload, X } from "lucide-react";
import type {
  Fixture,
  MemberSummary,
  ScorecardDraft,
  ScorecardDraftRubber,
  ScorecardLineupSlot,
} from "@shared/types.js";
import {
  DOUBLES_RUBBER,
  formatGames,
  matchScoreOf,
  outcomeOf,
  parseGames,
  slotsForRubber,
  type Game,
} from "@shared/scorecard.js";
import { PageHeader } from "@/components/layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Loading,
  Panel,
  SearchBox,
  TableNote,
} from "@/components/ui";
import { useFixtures } from "@/lib/queries";
import { adminFetch, fileToBase64, useAdminToken, type AdminError } from "@/lib/admin";
import { cn, formatDateShort } from "@/lib/utils";

/**
 * Entering a result.
 *
 * The shape of this screen follows one rule: **the machine proposes and a
 * person decides.** Reading a photograph is a shortcut past the typing,
 * not a replacement for the captain who was there — so a parse lands in
 * exactly the same editable form that manual entry starts from, with
 * every field changeable and every doubt shown next to the row it
 * concerns.
 *
 * That is also why the form is not generated from the parse. It is always
 * ten rubbers in the league card's printed order, whether anything filled
 * them in or not: a card is a fixed thing, and a form that grew or shrank
 * with what a model happened to read would hide a missing rubber instead
 * of showing an empty row.
 */

function isAdminError(error: unknown): error is AdminError {
  return typeof error === "object" && error !== null && "status" in error && "message" in error;
}

// ---------------------------------------------------------------------------

function SignIn({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The capability endpoint doubles as the password check: it is
      // behind the same gate and returns something the next screen needs.
      await adminFetch("/api/admin/scorecards/capability", value);
      onSignedIn(value);
    } catch (caught) {
      setError(isAdminError(caught) ? caught.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-prose">
      <PageHeader
        title="Enter a result"
        subtitle="For the committee and team captains"
      />
      <Card>
        <form onSubmit={submit} className="space-y-5">
          <Field
            label="Result-entry password"
            hint="The shared password the committee uses. Ask the match secretary if you need it."
            error={error ?? undefined}
            required
          >
            {(props) => (
              <input
                {...props}
                type="password"
                autoComplete="current-password"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            )}
          </Field>
          <Button type="submit" disabled={busy || value.length === 0}>
            {busy ? "Checking…" : "Continue"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Pick the match this card belongs to. */
function FixturePicker({ onPick }: { onPick: (fixture: Fixture) => void }) {
  const { data: fixtures, isLoading } = useFixtures("competition=league");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const all = fixtures ?? [];
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? all.filter((fixture) =>
          `${fixture.homeTeam.name} ${fixture.awayTeam.name}`.toLowerCase().includes(needle),
        )
      : all;
    // Unplayed first: a card being entered is nearly always for a match
    // with no result on it yet.
    return [...matched]
      .sort((a, b) => {
        const byStatus = Number(a.status === "played") - Number(b.status === "played");
        if (byStatus !== 0) return byStatus;
        return (a.weekCommencing ?? "").localeCompare(b.weekCommencing ?? "");
      })
      .slice(0, 40);
  }, [fixtures, query]);

  if (isLoading) return <Loading what="the fixtures" variant="list" />;

  return (
    <div className="space-y-4">
      <SearchBox
        label="Find the match"
        value={query}
        onChange={setQuery}
        placeholder="Team name"
      />
      {shown.length === 0 ? (
        <Empty>No matches found for that.</Empty>
      ) : (
        <ul className="space-y-2">
          {shown.map((fixture) => (
            <li key={fixture.id}>
              <button
                type="button"
                onClick={() => onPick(fixture)}
                className="flex min-h-touch w-full items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-sunken"
              >
                <span>
                  <span className="font-semibold">
                    {fixture.homeTeam.name} v {fixture.awayTeam.name}
                  </span>
                  <span className="block text-ink-muted">
                    {formatDateShort(fixture.weekCommencing ?? fixture.playedOn)}
                  </span>
                </span>
                {fixture.status === "played" ? (
                  <Badge tone="neutral">
                    {fixture.homeScore}–{fixture.awayScore} entered
                  </Badge>
                ) : (
                  <Badge tone="brand">To enter</Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** A player cell: pick from the squad, or keep the name the card had. */
function PlayerPicker({
  label,
  squad,
  id,
  name,
  options = [],
  onChange,
}: {
  label: string;
  squad: MemberSummary[];
  id: string | null;
  name: string | null;
  /** Member ids the card's name could equally have meant. */
  options?: string[];
  onChange: (id: string | null, name: string | null) => void;
}) {
  const unmatched = !id && name;
  const ambiguous = !id && options.length > 1;
  const named = options
    .map((option) => squad.find((member) => member.id === option)?.fullName)
    .filter(Boolean) as string[];

  return (
    <div>
      <select
        aria-label={label}
        value={id ?? ""}
        onChange={(event) => onChange(event.target.value || null, event.target.value ? null : name)}
        className={cn(
          "min-h-touch w-full rounded-card border bg-surface px-3 text-ink",
          unmatched ? "border-accent" : "border-line-strong",
        )}
      >
        {/*
         * Short on purpose. This used to repeat the name — “Sam Jones” —
         * not matched — which is both redundant with the line below and
         * too long for the doubles cells, where it truncated mid-word to
         * "not matcl". The name belongs under the field, where it has room.
         */}
        <option value="">
          {name ? (ambiguous ? "Which one?" : "Not matched") : "Nobody"}
        </option>
        {/*
         * The players the name could mean come first, under their own
         * heading. On a squad of eight, hunting for the two Sams in an
         * alphabetical list is the slow part of checking a card.
         */}
        {ambiguous ? (
          <optgroup label={`Could be “${name}”`}>
            {options.map((option) => {
              const member = squad.find((one) => one.id === option);
              return member ? (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ) : null;
            })}
          </optgroup>
        ) : null}
        <optgroup label={ambiguous ? "Everyone else" : "Squad"}>
          {squad
            .filter((member) => !ambiguous || !options.includes(member.id))
            .map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
        </optgroup>
      </select>

      {/* What the card said, kept visible beside who it was taken to mean. */}
      {unmatched ? (
        <p className="mt-1 text-ink-muted">
          {ambiguous ? (
            <>
              <span className="font-semibold text-ink">{name}</span> could be {named.join(" or ")}
            </>
          ) : (
            <>
              On the card: <span className="font-semibold text-ink">{name}</span>
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}

/** The letter the sheet gives a player: A, B, C or X, Y, Z. */
function SlotLetter({ letter }: { letter: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-card border border-line-strong bg-surface-sunken font-semibold tabular text-ink"
    >
      {letter}
    </span>
  );
}

/** Who a letter currently stands for: the chosen player, else the card's word for them. */
function slotName(slot: ScorecardLineupSlot | undefined, squad: MemberSummary[]): string {
  if (!slot) return "—";
  if (slot.memberId) {
    return squad.find((member) => member.id === slot.memberId)?.fullName ?? "—";
  }
  return slot.name ?? "—";
}

// ---------------------------------------------------------------------------

function ScorecardForm({
  draft,
  token,
  onSaved,
  onBack,
}: {
  draft: ScorecardDraft;
  token: string;
  onSaved: (result: { homeScore: number; awayScore: number }) => void;
  onBack: () => void;
}) {
  /*
   * The line-up is the state; the singles rubbers are a view of it.
   *
   * The sheet names its six players once, against the letters, and the
   * printed order does the rest — so correcting a misread "Sam" is one
   * change here rather than the same change in rubbers 2, 7 and 9. Only
   * the doubles keeps players of its own, because its pairing is the one
   * the letters do not settle.
   */
  const [homeLineup, setHomeLineup] = useState<ScorecardLineupSlot[]>(draft.homeLineup);
  const [awayLineup, setAwayLineup] = useState<ScorecardLineupSlot[]>(draft.awayLineup);
  const [doubles, setDoubles] = useState<ScorecardDraftRubber>(
    () =>
      draft.rubbers.find((rubber) => rubber.rubberNumber === DOUBLES_RUBBER) ??
      draft.rubbers[draft.rubbers.length - 1]!,
  );

  // Held as text so a half-typed "11-" is not thrown away on every keystroke.
  const [gameText, setGameText] = useState<string[]>(() =>
    draft.rubbers.map((rubber) => formatGames(rubber.games as Game[])),
  );
  const [playedOn, setPlayedOn] = useState(draft.playedOn ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => gameText.map((text) => parseGames(text)), [gameText]);
  const score = useMemo(
    () => matchScoreOf(parsed.map((entry) => ({ games: entry.games }))),
    [parsed],
  );

  const homeBySlot = useMemo(
    () => new Map(homeLineup.map((entry) => [entry.slot, entry])),
    [homeLineup],
  );
  const awayBySlot = useMemo(
    () => new Map(awayLineup.map((entry) => [entry.slot, entry])),
    [awayLineup],
  );

  function setSlot(side: "home" | "away", slot: string, memberId: string | null) {
    const apply = (current: ScorecardLineupSlot[]) =>
      current.map((entry) => (entry.slot === slot ? { ...entry, memberId } : entry));
    if (side === "home") setHomeLineup(apply);
    else setAwayLineup(apply);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const rubbers = draft.rubbers.map((rubber, index) => {
        const games = parsed[index]!.games;
        if (rubber.rubberNumber === DOUBLES_RUBBER) {
          return {
            rubberNumber: rubber.rubberNumber,
            kind: doubles.kind,
            homePlayerId: doubles.homePlayerId,
            homePlayer2Id: doubles.homePlayer2Id,
            awayPlayerId: doubles.awayPlayerId,
            awayPlayer2Id: doubles.awayPlayer2Id,
            homePlayerName: doubles.homePlayerName,
            awayPlayerName: doubles.awayPlayerName,
            games,
          };
        }

        // A singles takes its players from the line-up, every time. There
        // is nowhere else for them to come from and nowhere else to edit.
        const slots = slotsForRubber(rubber.rubberNumber);
        const home = homeBySlot.get(slots?.[0] ?? "");
        const away = awayBySlot.get(slots?.[1] ?? "");
        return {
          rubberNumber: rubber.rubberNumber,
          kind: "singles" as const,
          homePlayerId: home?.memberId ?? null,
          homePlayer2Id: null,
          awayPlayerId: away?.memberId ?? null,
          awayPlayer2Id: null,
          // Kept only where nobody was chosen, so the card still records
          // what it said about a guest or an unreconciled spelling.
          homePlayerName: home?.memberId ? null : (home?.name ?? null),
          awayPlayerName: away?.memberId ? null : (away?.name ?? null),
          games,
        };
      });

      const result = await adminFetch<{ homeScore: number; awayScore: number }>(
        "/api/admin/scorecards",
        token,
        {
          method: "POST",
          body: { fixtureId: draft.fixtureId, playedOn: playedOn || null, rubbers },
        },
      );
      onSaved(result);
    } catch (caught) {
      setError(isAdminError(caught) ? caught.message : "The card could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  /** Warnings from the server, filed by the rubber they belong to. */
  const byRubber = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const warning of draft.warnings) {
      if (warning.rubberNumber === null) continue;
      map.set(warning.rubberNumber, [...(map.get(warning.rubberNumber) ?? []), warning.message]);
    }
    return map;
  }, [draft.warnings]);

  const general = draft.warnings.filter((warning) => warning.rubberNumber === null);

  /** One side's three letters, as the box at the top of the sheet. */
  function LineupBox({
    side,
    teamName,
    entries,
    squad,
  }: {
    side: "home" | "away";
    teamName: string;
    entries: ScorecardLineupSlot[];
    squad: MemberSummary[];
  }) {
    return (
      <div className="space-y-3">
        <p className="font-semibold">{teamName}</p>
        {entries.map((entry) => (
          <div key={entry.slot} className="flex items-start gap-3">
            <SlotLetter letter={entry.slot} />
            <div className="min-w-0 flex-1">
              <PlayerPicker
                label={`${teamName} player ${entry.slot}`}
                squad={squad}
                id={entry.memberId}
                name={entry.name}
                options={entry.options}
                onChange={(id) => setSlot(side, entry.slot, id)}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl">
            {draft.homeTeam.name} v {draft.awayTeam.name}
          </h2>
          <p className="text-ink-muted">
            The card as it is printed: the six players against their letters, then ten rubbers —
            nine singles in the league's order, and the doubles.
          </p>
        </div>
        <Button variant="secondary" onClick={onBack}>
          Pick a different match
        </Button>
      </div>

      {general.length > 0 ? (
        <Alert tone="warning" title="Worth checking">
          <ul className="list-disc space-y-1 pl-5">
            {general.map((warning) => (
              <li key={warning.message}>{warning.message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="max-w-xs">
        <Field label="Date played" hint="The date on the card.">
          {(props) => (
            <input
              {...props}
              type="date"
              value={playedOn}
              onChange={(event) => setPlayedOn(event.target.value)}
            />
          )}
        </Field>
      </div>

      {/*
       * The line-up box, first, exactly as it sits on the sheet. Getting
       * these six right is most of checking a card: every singles row
       * below follows from them, so a name fixed here is fixed in all
       * three of that player's rubbers at once.
       */}
      <Card>
        <h3 className="text-xl">Who played</h3>
        <p className="mt-1 text-ink-muted">
          The card names three players a side against these letters. The nine singles below are
          then fixed by the league's printed order — change a player here and their rubbers follow.
        </p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <LineupBox
            side="home"
            teamName={draft.homeTeam.name}
            entries={homeLineup}
            squad={draft.homeSquad}
          />
          <LineupBox
            side="away"
            teamName={draft.awayTeam.name}
            entries={awayLineup}
            squad={draft.awaySquad}
          />
        </div>
      </Card>

      <TableNote>
        Type the games as they are written — <strong>11-8, 9-11, 11-6</strong>. The sets and the
        match score work themselves out.
      </TableNote>

      {/*
       * The rubbers as a table, in the card's own order and shape: number,
       * who against who, the five game columns as one field, and the sets.
       * A person checking a photograph reads down a column, so the screen
       * is a column too.
       */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse">
          <caption className="sr-only">
            The ten rubbers, in the order the card prints them
          </caption>
          <thead>
            <tr className="border-b border-line-strong text-left">
              <th scope="col" className="py-2 pr-2 font-semibold">
                #
              </th>
              <th scope="col" className="w-1/4 py-2 pr-2 font-semibold">
                {draft.homeTeam.name}
              </th>
              <th scope="col" className="w-1/4 py-2 pr-2 font-semibold">
                {draft.awayTeam.name}
              </th>
              <th scope="col" className="py-2 pr-2 font-semibold">
                Games ({draft.homeTeam.name} first)
              </th>
              <th scope="col" className="py-2 font-semibold">
                Sets
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.rubbers.map((rubber, index) => {
              const entry = parsed[index]!;
              const outcome = outcomeOf(entry.games);
              const isDoubles = rubber.rubberNumber === DOUBLES_RUBBER;
              const slots = slotsForRubber(rubber.rubberNumber);
              const problems = byRubber.get(rubber.rubberNumber) ?? [];
              const home = homeBySlot.get(slots?.[0] ?? "");
              const away = awayBySlot.get(slots?.[1] ?? "");

              return (
                <tr
                  key={rubber.rubberNumber}
                  className={cn(
                    "border-b border-line align-top",
                    isDoubles && "bg-brand-soft",
                  )}
                >
                  <th scope="row" className="py-3 pr-2 text-left font-semibold tabular">
                    {rubber.rubberNumber}
                  </th>

                  {isDoubles ? (
                    <>
                      <td className="min-w-[13rem] py-3 pr-2">
                        <div className="space-y-2">
                          <PlayerPicker
                            label={`Doubles, ${draft.homeTeam.name} player`}
                            squad={draft.homeSquad}
                            id={doubles.homePlayerId}
                            name={doubles.homePlayerName}
                            onChange={(id, name) =>
                              setDoubles((current) => ({
                                ...current,
                                homePlayerId: id,
                                homePlayerName: name,
                              }))
                            }
                          />
                          <PlayerPicker
                            label={`Doubles, ${draft.homeTeam.name} partner`}
                            squad={draft.homeSquad}
                            id={doubles.homePlayer2Id}
                            name={doubles.homePlayer2Name}
                            onChange={(id, name) =>
                              setDoubles((current) => ({
                                ...current,
                                homePlayer2Id: id,
                                homePlayer2Name: name,
                              }))
                            }
                          />
                        </div>
                      </td>
                      <td className="min-w-[13rem] py-3 pr-2">
                        <div className="space-y-2">
                          <PlayerPicker
                            label={`Doubles, ${draft.awayTeam.name} player`}
                            squad={draft.awaySquad}
                            id={doubles.awayPlayerId}
                            name={doubles.awayPlayerName}
                            onChange={(id, name) =>
                              setDoubles((current) => ({
                                ...current,
                                awayPlayerId: id,
                                awayPlayerName: name,
                              }))
                            }
                          />
                          <PlayerPicker
                            label={`Doubles, ${draft.awayTeam.name} partner`}
                            squad={draft.awaySquad}
                            id={doubles.awayPlayer2Id}
                            name={doubles.awayPlayer2Name}
                            onChange={(id, name) =>
                              setDoubles((current) => ({
                                ...current,
                                awayPlayer2Id: id,
                                awayPlayer2Name: name,
                              }))
                            }
                          />
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      {/*
                       * Read-only, and deliberately so: a singles player is
                       * the line-up's answer, and a second place to change
                       * it is a second place for the two to disagree.
                       */}
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-2">
                          <SlotLetter letter={slots?.[0] ?? "?"} />
                          <span className={cn(!home?.memberId && "text-ink-muted")}>
                            {slotName(home, draft.homeSquad)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-2">
                          <SlotLetter letter={slots?.[1] ?? "?"} />
                          <span className={cn(!away?.memberId && "text-ink-muted")}>
                            {slotName(away, draft.awaySquad)}
                          </span>
                        </div>
                      </td>
                    </>
                  )}

                  <td className="py-3 pr-2">
                    <label htmlFor={`games-${rubber.rubberNumber}`} className="sr-only">
                      Rubber {rubber.rubberNumber} games, {draft.homeTeam.name} first
                    </label>
                    <input
                      id={`games-${rubber.rubberNumber}`}
                      inputMode="numeric"
                      placeholder="11-8, 9-11, 11-6"
                      value={gameText[index]}
                      onChange={(event) =>
                        setGameText((current) =>
                          current.map((text, i) => (i === index ? event.target.value : text)),
                        )
                      }
                      className="min-h-touch w-full min-w-[12rem] rounded-card border border-line-strong bg-surface px-3 text-ink"
                    />
                    {entry.invalid.length > 0 ? (
                      <p className="mt-1 font-semibold text-negative">
                        ⚠ Could not read: {entry.invalid.join(", ")}
                      </p>
                    ) : null}
                    {problems.length > 0 ? (
                      <ul className="mt-1 space-y-1 text-accent">
                        {problems.map((problem) => (
                          <li key={problem}>⚠ {problem}</li>
                        ))}
                      </ul>
                    ) : null}
                  </td>

                  {/* Nowrap: "not finished" broke over three lines and made
                      every unfinished rubber twice the height of a done one. */}
                  <td className="whitespace-nowrap py-3 tabular">
                    {outcome.homeSets}–{outcome.awaySets}
                    {entry.games.length > 0 && !outcome.complete ? (
                      <span className="block text-ink-muted">unfinished</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Panel className="sticky bottom-0 flex flex-wrap items-center justify-between gap-4">
        <p className="text-lg">
          <span className="font-semibold">
            {draft.homeTeam.name} {score.home} – {score.away} {draft.awayTeam.name}
          </span>
          <span className="block text-ink-muted">
            Worked out from the games, not typed — so the card and the result cannot disagree.
          </span>
        </p>
        <div className="flex items-center gap-3">
          {error ? <span className="font-semibold text-negative">{error}</span> : null}
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save this card"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CardUpload({
  fixture,
  token,
  aiAvailable,
  onDraft,
}: {
  fixture: Fixture;
  token: string;
  aiAvailable: boolean;
  onDraft: (draft: ScorecardDraft) => void;
}) {
  const [busy, setBusy] = useState(false);
  /*
   * The status is kept alongside the message, because the two failures
   * read completely differently to the person holding the card.
   *
   * A 503 means the reading could not be attempted at all — no key, a key
   * the API rejects, a workspace it will not infer, an outage. Nothing
   * about the photograph would change it. Titling that "That did not work"
   * blames the captain for the server's configuration and sends them off
   * to take a better photograph of a card that was never the problem.
   */
  const [error, setError] = useState<{ message: string; status: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // The object URL is a resource, not a value; leaking one per photograph
  // is a slow leak on a screen somebody enters twenty cards on.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function readCard(file: File) {
    setBusy(true);
    setError(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    try {
      const image = await fileToBase64(file);
      const draft = await adminFetch<ScorecardDraft>("/api/admin/scorecards/parse", token, {
        method: "POST",
        body: { fixtureId: fixture.id, mediaType: file.type, image },
      });
      onDraft(draft);
    } catch (caught) {
      setError(
        isAdminError(caught)
          ? { message: caught.message, status: caught.status }
          : { message: "The card could not be read.", status: 0 },
      );
    } finally {
      setBusy(false);
    }
  }

  async function blank() {
    setBusy(true);
    setError(null);
    try {
      onDraft(
        await adminFetch<ScorecardDraft>(`/api/admin/scorecards/blank/${fixture.id}`, token),
      );
    } catch (caught) {
      setError(
        isAdminError(caught)
          ? { message: caught.message, status: caught.status }
          : { message: "That did not work.", status: 0 },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-xl">
          {fixture.homeTeam.name} v {fixture.awayTeam.name}
        </h2>
        <p className="text-ink-muted">
          Photograph the card and let it be read, or type it in yourself. Either way you check every
          line before it is saved.
        </p>
      </div>

      {!aiAvailable ? (
        // Said plainly rather than by a greyed-out button with no
        // explanation. The feature is configured off, not broken.
        <Alert tone="info" title="Reading cards from a photo is switched off">
          No Anthropic API key is set on this deployment, so a photograph cannot be read
          automatically. Typing the card in works exactly the same way.
        </Alert>
      ) : null}

      {error ? (
        error.status === 503 ? (
          <Alert tone="info" title="Reading photographs is not working at the moment">
            {error.message}
          </Alert>
        ) : (
          <Alert tone="warning" title="That card could not be read">
            {error.message}
          </Alert>
        )
      ) : null}

      {preview ? (
        <div className="relative">
          {/* The photograph stays on screen while the card is checked
              against it — that comparison is the whole review. */}
          <img
            src={preview}
            alt="The scorecard you uploaded"
            className="max-h-96 w-full rounded-card border border-line object-contain"
          />
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-card border border-line bg-surface"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Remove this photograph</span>
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <label
          className={cn(
            "inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-card border px-5 font-semibold transition-colors",
            aiAvailable && !busy
              ? "border-brand bg-brand text-brand-ink hover:bg-brand-strong"
              : "pointer-events-none border-line bg-surface-sunken text-ink-muted",
          )}
        >
          <Upload aria-hidden="true" className="size-5" />
          {busy ? "Reading the card…" : "Choose a photograph"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={!aiAvailable || busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readCard(file);
            }}
          />
        </label>

        <Button variant="secondary" onClick={blank} disabled={busy}>
          Type the card in instead
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function AdminScorecardsPage() {
  const [token, setToken] = useAdminToken();
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [draft, setDraft] = useState<ScorecardDraft | null>(null);
  const [saved, setSaved] = useState<{ homeScore: number; awayScore: number } | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);

  useEffect(() => {
    if (!token) return;
    adminFetch<{ ai: boolean }>("/api/admin/scorecards/capability", token)
      .then((capability) => setAiAvailable(capability.ai))
      .catch(() => setToken(null));
  }, [token, setToken]);

  if (!token) return <SignIn onSignedIn={setToken} />;

  if (saved && draft) {
    return (
      <div className="max-w-prose space-y-6">
        <PageHeader title="Card saved" subtitle="It is on the site now." />
        <Alert tone="success" title="Saved">
          {draft.homeTeam.name} {saved.homeScore} – {saved.awayScore} {draft.awayTeam.name}. The
          league table has already changed to match.
        </Alert>
        <div className="flex flex-wrap gap-3">
          <Link href={`/results/${draft.fixtureId}`} className="link font-semibold">
            See the match page
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              setSaved(null);
              setDraft(null);
              setFixture(null);
            }}
          >
            Enter another card
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enter a result"
        subtitle="Photograph the card, check what it says, and save it."
        actions={
          <Button variant="quiet" onClick={() => setToken(null)}>
            Sign out
          </Button>
        }
      />

      {!fixture ? (
        <FixturePicker
          onPick={(picked) => {
            setFixture(picked);
            setDraft(null);
          }}
        />
      ) : !draft ? (
        <>
          <Button variant="quiet" onClick={() => setFixture(null)}>
            ← Pick a different match
          </Button>
          <CardUpload
            fixture={fixture}
            token={token}
            aiAvailable={aiAvailable}
            onDraft={setDraft}
          />
        </>
      ) : (
        <ScorecardForm
          draft={draft}
          token={token}
          onSaved={setSaved}
          onBack={() => {
            setDraft(null);
            setFixture(null);
          }}
        />
      )}
    </div>
  );
}
