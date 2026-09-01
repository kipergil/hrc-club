import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Upload, X } from "lucide-react";
import type { Fixture, MemberSummary, ScorecardDraft, ScorecardDraftRubber } from "@shared/types.js";
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
  onChange,
}: {
  label: string;
  squad: MemberSummary[];
  id: string | null;
  name: string | null;
  onChange: (id: string | null, name: string | null) => void;
}) {
  const unmatched = !id && name;
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
        <option value="">{name ? `“${name}” — not matched` : "Nobody"}</option>
        {squad.map((member) => (
          <option key={member.id} value={member.id}>
            {member.fullName}
          </option>
        ))}
      </select>
      {/* What the card said, kept visible beside who it was taken to mean. */}
      {unmatched ? (
        <p className="mt-1 text-ink-muted">
          On the card: <span className="font-semibold text-ink">{name}</span>
        </p>
      ) : null}
    </div>
  );
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
  const [rubbers, setRubbers] = useState<ScorecardDraftRubber[]>(draft.rubbers);
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

  function update(index: number, patch: Partial<ScorecardDraftRubber>) {
    setRubbers((current) =>
      current.map((rubber, i) => (i === index ? { ...rubber, ...patch } : rubber)),
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = await adminFetch<{ homeScore: number; awayScore: number }>(
        "/api/admin/scorecards",
        token,
        {
          method: "POST",
          body: {
            fixtureId: draft.fixtureId,
            playedOn: playedOn || null,
            rubbers: rubbers.map((rubber, index) => ({
              rubberNumber: rubber.rubberNumber,
              kind: rubber.kind,
              homePlayerId: rubber.homePlayerId,
              homePlayer2Id: rubber.homePlayer2Id,
              awayPlayerId: rubber.awayPlayerId,
              awayPlayer2Id: rubber.awayPlayer2Id,
              homePlayerName: rubber.homePlayerName,
              awayPlayerName: rubber.awayPlayerName,
              games: parsed[index]!.games,
            })),
          },
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl">
            {draft.homeTeam.name} v {draft.awayTeam.name}
          </h2>
          <p className="text-ink-muted">
            The card is ten rubbers: nine singles in the league's printed order, then the doubles.
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

      <TableNote>
        Type the games as they are written — <strong>11-8, 9-11, 11-6</strong>. The sets and the
        match score work themselves out.
      </TableNote>

      <ol className="space-y-3">
        {rubbers.map((rubber, index) => {
          const entry = parsed[index]!;
          const outcome = outcomeOf(entry.games);
          const isDoubles = rubber.rubberNumber === DOUBLES_RUBBER;
          const slots = slotsForRubber(rubber.rubberNumber);
          const problems = byRubber.get(rubber.rubberNumber) ?? [];

          return (
            <li key={rubber.rubberNumber}>
              <Card className={cn(isDoubles && "border-brand bg-brand-soft")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    <span className="tabular">{rubber.rubberNumber}.</span>{" "}
                    {isDoubles ? "Doubles" : `${slots?.[0]} v ${slots?.[1]}`}
                  </p>
                  <p className="tabular text-ink-muted">
                    {outcome.homeSets}–{outcome.awaySets}
                    {entry.games.length > 0 && !outcome.complete ? " · not finished" : ""}
                  </p>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="font-semibold text-ink-muted">{draft.homeTeam.name}</p>
                    <PlayerPicker
                      label={`Rubber ${rubber.rubberNumber}, ${draft.homeTeam.name} player`}
                      squad={draft.homeSquad}
                      id={rubber.homePlayerId}
                      name={rubber.homePlayerName}
                      onChange={(id, name) => update(index, { homePlayerId: id, homePlayerName: name })}
                    />
                    {isDoubles ? (
                      <PlayerPicker
                        label={`Doubles, ${draft.homeTeam.name} partner`}
                        squad={draft.homeSquad}
                        id={rubber.homePlayer2Id}
                        name={rubber.homePlayer2Name}
                        onChange={(id, name) =>
                          update(index, { homePlayer2Id: id, homePlayer2Name: name })
                        }
                      />
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold text-ink-muted">{draft.awayTeam.name}</p>
                    <PlayerPicker
                      label={`Rubber ${rubber.rubberNumber}, ${draft.awayTeam.name} player`}
                      squad={draft.awaySquad}
                      id={rubber.awayPlayerId}
                      name={rubber.awayPlayerName}
                      onChange={(id, name) => update(index, { awayPlayerId: id, awayPlayerName: name })}
                    />
                    {isDoubles ? (
                      <PlayerPicker
                        label={`Doubles, ${draft.awayTeam.name} partner`}
                        squad={draft.awaySquad}
                        id={rubber.awayPlayer2Id}
                        name={rubber.awayPlayer2Name}
                        onChange={(id, name) =>
                          update(index, { awayPlayer2Id: id, awayPlayer2Name: name })
                        }
                      />
                    ) : null}
                  </div>
                </div>

                <div className="mt-3">
                  <label
                    htmlFor={`games-${rubber.rubberNumber}`}
                    className="block font-semibold text-ink"
                  >
                    Games ({draft.homeTeam.name} first)
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
                    className="mt-2 min-h-touch w-full rounded-card border border-line-strong bg-surface px-3 text-ink"
                  />
                  {entry.invalid.length > 0 ? (
                    <p className="mt-2 font-semibold text-negative">
                      ⚠ Could not read: {entry.invalid.join(", ")}
                    </p>
                  ) : null}
                </div>

                {problems.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-accent">
                    {problems.map((problem) => (
                      <li key={problem}>⚠ {problem}</li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ol>

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
  const [error, setError] = useState<string | null>(null);
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
      setError(isAdminError(caught) ? caught.message : "The card could not be read.");
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
      setError(isAdminError(caught) ? caught.message : "That did not work.");
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
        <Alert tone="warning" title="That did not work">
          {error}
        </Alert>
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
