import { ArrowLeft } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Link } from "wouter";
import type { PlayerRubber, PlayerStatistics } from "@shared/types.js";
import { PageHeader } from "@/components/layout";
import { Disclosure, Empty, ErrorNote, Loading } from "@/components/ui";
import {
  COLOR,
  ChartFigure,
  ColumnChart,
  DotChart,
  Legend,
  LineChart,
  WonLostBars,
  type ChartTable,
  type Dot,
} from "@/components/charts";
import { StatPicker } from "@/components/stat-picker";
import { usePlayerStatistics } from "@/lib/queries";
import { useUrlParam, useUrlParams } from "@/lib/params";
import {
  CHART_GROUPS,
  STAT_CHARTS,
  chartById,
  defaultChartIds,
  evidenceFromStatistics,
  parseChartIds,
} from "@/lib/stat-charts";
import {
  byOpponentStrength,
  cardSeasons,
  careerTotals,
  divisionSpread,
  doublesByPartner,
  formByNight,
  gamesOf,
  headToHead,
  homeAndAway,
  marginCounts,
  matchNights,
  opponentName,
  ordinal,
  playerName,
  pointsShare,
  pressure,
  rollingForm,
  runningRate,
  singlesOf,
  teamMates,
  type MatchNight,
} from "@/lib/player-stats";
import { cn, divisionLabel, formatDateShort } from "@/lib/utils";

/**
 * A player's statistics, as charts — only the ones asked for.
 *
 * Its own page, reached from the player's profile, for three reasons that
 * are all about cost. The code for it is a separate download, fetched
 * only when somebody opens it (see `App.tsx`). Its data is a separate
 * request, so the profile never carries a career of games. And it draws
 * only the charts in `?charts=`, so a reader after one answer is not made
 * to wait for eighteen.
 */
export default function PlayerStatsPage({ slug }: { slug: string }) {
  const { data, isLoading, isError } = usePlayerStatistics(slug);
  const [chartsParam] = useUrlParam("charts");
  const [seasonParam] = useUrlParam("season");
  const setParams = useUrlParams();

  const evidence = useMemo(() => (data ? evidenceFromStatistics(data) : null), [data]);
  const seasonsWithCards = useMemo(() => (data ? cardSeasons(data.rubbers) : []), [data]);
  const cardSeason = seasonsWithCards.includes(seasonParam ?? "") ? seasonParam! : seasonsWithCards[0];
  const scoped = useMemo(
    () => (data ? data.rubbers.filter((rubber) => rubber.seasonLabel === cardSeason) : []),
    [data, cardSeason],
  );

  if (isLoading) return <Loading what="the statistics" variant="page" />;
  if (isError || !data || !evidence) return <ErrorNote what="player statistics" />;

  const name = playerName(data);
  const requested = parseChartIds(chartsParam);
  const chosen = requested.length > 0 ? requested : defaultChartIds(evidence);
  const drawable = chosen.filter((id) => chartById(id)!.needs(evidence) === null);
  const waiting = chosen.filter((id) => chartById(id)!.needs(evidence) !== null);

  const context: ChartContext = {
    data,
    name,
    nights: matchNights(scoped),
    singles: singlesOf(scoped),
    rubbers: scoped,
    cardSeason: cardSeason ?? null,
  };

  return (
    <div>
      <PageHeader
        title={`${name}: statistics`}
        subtitle="Charts from the match cards and the league's averages. Pick the ones you want to see."
        actions={
          <Link
            href={`/players/${slug}`}
            className="inline-flex min-h-touch items-center gap-2 rounded-card border border-line-strong bg-surface px-4 font-semibold text-ink no-underline hover:border-brand"
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
            Back to the profile
          </Link>
        }
      />

      <div className="mb-8 space-y-4">
        <Disclosure summary="Choose charts" meta={`${drawable.length} shown`}>
          <StatPicker
            // Remounted with the URL, so the ticks always match what is drawn.
            key={chosen.join(",")}
            slug={slug}
            evidence={evidence}
            initial={chosen}
            onApply={(ids) => setParams({ charts: ids.join(",") })}
          />
        </Disclosure>

        {seasonsWithCards.length > 1 ? (
          <div className="no-print">
            <label htmlFor="card-season" className="block font-semibold">
              Match-by-match charts for
            </label>
            <select
              id="card-season"
              value={cardSeason}
              onChange={(event) => setParams({ season: event.target.value })}
              className="mt-2 min-h-touch rounded-card border border-line-strong bg-surface px-3 text-ink"
            >
              {seasonsWithCards.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {waiting.length > 0 ? (
          <p className="text-ink-muted">
            Not shown, because there is not enough on record for {name} yet:{" "}
            {waiting
              .map((id) => `${chartById(id)!.title.toLowerCase()} (${chartById(id)!.needs(evidence)})`)
              .join("; ")}
            .
          </p>
        ) : null}
      </div>

      {drawable.length === 0 ? (
        <Empty>
          Nothing to draw yet. Charts appear as {name}&rsquo;s match cards are entered.
        </Empty>
      ) : (
        <div className="space-y-12">
          {CHART_GROUPS.map((group) => {
            const ids = drawable.filter((id) => chartById(id)!.group === group.id);
            if (ids.length === 0) return null;
            return (
              <section key={group.id} aria-labelledby={`group-${group.id}`}>
                <h2 id={`group-${group.id}`} className="text-2xl">
                  {group.title}
                </h2>
                <p className="mb-4 mt-1 text-ink-muted">
                  {group.id === "matches" && cardSeason ? `From the ${cardSeason} match cards.` : group.blurb}
                </p>
                <div className="grid gap-5 lg:grid-cols-2">
                  {ids.map((id) => (
                    <StatChart key={id} id={id} context={context} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-10 max-w-readable text-ink-muted">
        Match-by-match charts come from the cards entered on this site, which go back to the 2026-27
        season; the league clears its old cards each year. Season figures before that are the league&rsquo;s
        published averages.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface ChartContext {
  data: PlayerStatistics;
  name: string;
  nights: MatchNight[];
  singles: PlayerRubber[];
  rubbers: PlayerRubber[];
  cardSeason: string | null;
}

const percent = (value: number) => `${value}%`;
const won = (rows: Array<{ won: number; lost: number }>) => rows.reduce((sum, row) => sum + row.won, 0);
const played = (rows: Array<{ won: number; lost: number }>) => rows.reduce((sum, row) => sum + row.won + row.lost, 0);
const surname = (full: string) => full.split(" ").slice(-1)[0] ?? full;

/** One chart, by catalogue id. Exported for the tests, which draw every one. */
export function StatChart({ id, context }: { id: string; context: ChartContext }) {
  const spec = STAT_CHARTS.find((chart) => chart.id === id)!;
  const { data, name, nights, singles, rubbers } = context;
  const seasons = data.seasons;
  const figure = (props: { reading?: ReactNode; table?: ChartTable; wide?: boolean; children: ReactNode }) => (
    <ChartFigure title={spec.title} question={spec.question} {...props} />
  );

  switch (id) {
    case "season-rate": {
      const best = seasons.reduce((top, season) => ((season.winPercentage ?? -1) > (top.winPercentage ?? -1) ? season : top));
      return figure({
        reading: `Best season: ${best.winPercentage}% in ${best.seasonLabel}. The dashed line is the middle of the division's eligible players.`,
        table: {
          head: ["Season", `${name}`, "Division median"],
          rows: seasons.map((s) => [s.seasonLabel, s.winPercentage === null ? "—" : `${s.winPercentage}%`, s.divisionMedian === null ? "—" : `${s.divisionMedian}%`]),
        },
        children: (
          <LineChart
            label={`${name}'s singles win rate each season, against the division median`}
            categories={seasons.map((s) => s.seasonLabel)}
            series={[
              { label: name, values: seasons.map((s) => s.winPercentage), color: COLOR.player, main: true },
              { label: "Division median", values: seasons.map((s) => s.divisionMedian), color: COLOR.others, dashed: true },
            ]}
            domain={[0, 100]}
            format={percent}
            tip={(i) => [seasons[i]!.seasonLabel, `${name}: ${seasons[i]!.winPercentage ?? "—"}%`, `Division median: ${seasons[i]!.divisionMedian ?? "—"}%`]}
          />
        ),
      });
    }

    case "season-record": {
      const total = seasons.reduce((sum, s) => sum + s.played, 0);
      const wins = seasons.reduce((sum, s) => sum + s.won, 0);
      return figure({
        reading: `${wins} won from ${total} singles across ${seasons.length} seasons.`,
        table: { head: ["Season", "Played", "Won", "Lost"], rows: seasons.map((s) => [s.seasonLabel, s.played, s.won, s.lost]) },
        children: (
          <ColumnChart
            label={`Singles won and lost by ${name} each season`}
            categories={seasons.map((s) => s.seasonLabel)}
            up={{ label: "Won", values: seasons.map((s) => s.won), color: COLOR.won }}
            down={{ label: "Lost", values: seasons.map((s) => s.lost), color: COLOR.lost }}
            yLabel="singles"
            tip={(i) => [seasons[i]!.seasonLabel, `Won ${seasons[i]!.won}`, `Lost ${seasons[i]!.lost}`]}
          />
        ),
      });
    }

    case "season-placing": {
      const worst = Math.max(3, ...seasons.map((s) => s.place ?? 0));
      const unplaced = seasons.filter((s) => s.place === null).map((s) => s.seasonLabel);
      return figure({
        reading: unplaced.length
          ? `Not placed in ${unplaced.join(", ")}: below the league's 50%-of-matches rule.`
          : `Placed every season on record.`,
        table: {
          head: ["Season", "Placing", "Eligible players"],
          rows: seasons.map((s) => [s.seasonLabel, s.place === null ? "Not placed" : ordinal(s.place, s.tied), s.placedOf]),
        },
        children: (
          <LineChart
            label={`${name}'s placing in the division averages each season, first at the top`}
            categories={seasons.map((s) => s.seasonLabel)}
            series={[
              {
                label: "Placing",
                values: seasons.map((s) => s.place),
                color: COLOR.player,
                main: true,
                pointLabels: seasons.map((s) => (s.place === null ? null : `${ordinal(s.place, s.tied)} of ${s.placedOf}`)),
              },
            ]}
            domain={[1, worst + 1]}
            reverse
            integerTicks
            tip={(i) => [seasons[i]!.seasonLabel, seasons[i]!.place === null ? "Not placed" : `${ordinal(seasons[i]!.place!, seasons[i]!.tied)} of ${seasons[i]!.placedOf}`]}
          />
        ),
      });
    }

    case "availability": {
      const rows = seasons.filter((s) => s.matchesPlayed !== null && s.teamMatchesPlayed !== null);
      return figure({
        reading: "The mark on each bar is half the team's matches: the league places a player only once they reach it.",
        table: {
          head: ["Season", "Played", "Team's matches"],
          rows: rows.map((s) => [s.seasonLabel, s.matchesPlayed!, s.teamMatchesPlayed!]),
        },
        children: (
          <>
            <Legend items={[{ label: "Played", color: COLOR.player }, { label: "Missed", color: COLOR.grid }]} />
            <ul className="space-y-3">
              {rows.map((s) => {
                const share = (s.matchesPlayed! / s.teamMatchesPlayed!) * 100;
                return (
                  <li key={s.seasonLabel} className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:items-center sm:gap-3">
                    <span className="font-semibold">{s.seasonLabel}</span>
                    <span className="flex items-center gap-3">
                      <span className="relative flex h-5 flex-1 overflow-hidden rounded" style={{ background: COLOR.grid }} aria-hidden="true">
                        <span className="h-full" style={{ width: `${share}%`, background: COLOR.player }} />
                        <span className="absolute inset-y-0 w-0.5" style={{ left: "50%", background: COLOR.ink }} />
                      </span>
                      <span className="w-32 shrink-0 text-right tabular text-ink-muted">
                        {s.matchesPlayed} of {s.teamMatchesPlayed}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ),
      });
    }

    case "career": {
      const totals = careerTotals(seasons);
      const last = totals[totals.length - 1]!;
      return figure({
        reading: `${last.won} won and ${last.lost} lost since ${seasons[0]!.seasonLabel}.`,
        table: { head: ["After", "Won", "Lost"], rows: totals.map((t) => [t.season, t.won, t.lost]) },
        children: (
          <LineChart
            label={`Running total of ${name}'s singles won and lost`}
            categories={totals.map((t) => t.season)}
            series={[
              { label: "Won", values: totals.map((t) => t.won), color: COLOR.won, main: true },
              { label: "Lost", values: totals.map((t) => t.lost), color: COLOR.lost, main: true },
            ]}
            domain={[0, Math.max(4, last.won)]}
            integerTicks
            tip={(i) => [`After ${totals[i]!.season}`, `Won ${totals[i]!.won}`, `Lost ${totals[i]!.lost}`]}
          />
        ),
      });
    }

    case "division": {
      const peers = data.peers!;
      const { eligible, me, above } = divisionSpread(peers.players, data.slug);
      const dots: Dot[] = eligible
        .filter((peer) => peer.memberSlug !== data.slug)
        .map((peer) => ({
          x: peer.winPercentage!,
          label: peer.memberName,
          tip: [peer.memberName, `${peer.teamName ?? ""} · ${peer.winPercentage}% from ${peer.played}`],
        }));
      if (me?.winPercentage != null) {
        dots.push({ x: me.winPercentage, label: name, main: true, named: true, tip: [name, `${me.winPercentage}% from ${me.played}`] });
      }
      return figure({
        reading:
          me?.winPercentage == null
            ? `${name} has no singles in ${peers.seasonLabel} yet.`
            : above === 0
              ? `No eligible player in ${divisionLabel(peers.division!)} is above ${name} in ${peers.seasonLabel}.`
              : `${above} of the ${eligible.length} eligible players in ${divisionLabel(peers.division!)} are above ${name} in ${peers.seasonLabel}.`,
        table: {
          head: ["Player", "Team", "Played", "Win %"],
          rows: [...eligible]
            .sort((a, b) => b.winPercentage! - a.winPercentage!)
            .map((peer) => [peer.memberName, peer.teamName ?? "—", peer.played, `${peer.winPercentage}%`]),
        },
        children: (
          <DotChart
            label={`Every eligible ${peers.division ? divisionLabel(peers.division) : ""} player's win rate in ${peers.seasonLabel}, with ${name} picked out`}
            dots={dots}
            xDomain={[0, 100]}
            xFormat={percent}
            xLabel={`singles win rate, ${peers.seasonLabel}`}
          />
        ),
      });
    }

    case "team-mates": {
      const peers = data.peers!;
      const mates = teamMates(peers.players, peers.teamSlug);
      const maxPlayed = Math.max(3, ...mates.map((m) => m.played));
      return figure({
        reading: `Everyone with averages for ${mates[0]?.teamName ?? "the team"} in ${peers.seasonLabel}.`,
        table: {
          head: ["Player", "Played", "Win %"],
          rows: mates.map((m) => [m.memberName, m.played, `${m.winPercentage}%`]),
        },
        children: (
          <DotChart
            label={`${name} and team-mates: singles played against win rate`}
            dots={mates.map((m) => ({
              x: m.played,
              y: m.winPercentage!,
              label: surname(m.memberName),
              main: m.memberSlug === data.slug,
              named: true,
              tip: [m.memberName, `${m.winPercentage}% from ${m.played} singles`],
            }))}
            xDomain={[0, maxPlayed + 1]}
            yDomain={[0, 100]}
            yFormat={percent}
            xLabel="singles played"
            height={280}
          />
        ),
      });
    }

    case "form": {
      const rows = formByNight(nights);
      const dated = nights.filter((n) => n.singles.length > 0);
      return figure({
        wide: true,
        reading: `${won(rows)} of ${played(rows)} singles won over ${rows.length} match${rows.length === 1 ? "" : "es"}.`,
        table: {
          head: ["Match", "Date", "Won", "Lost"],
          rows: rows.map((r, i) => [r.label, formatDateShort(dated[i]!.playedOn), r.won, r.lost]),
        },
        children: (
          <ColumnChart
            label={`Singles won and lost by ${name} in each match`}
            categories={rows.map((r) => r.label)}
            up={{ label: "Won", values: rows.map((r) => r.won), color: COLOR.won }}
            down={{ label: "Lost", values: rows.map((r) => r.lost), color: COLOR.lost }}
            yMax={3}
            tip={(i) => [`${rows[i]!.label}, ${formatDateShort(dated[i]!.playedOn)}`, ...dated[i]!.singles.map((s) => `${s.won ? "Beat" : "Lost to"} ${opponentName(s)} ${s.setsFor}–${s.setsAgainst}`)]}
          />
        ),
      });
    }

    case "running-rate": {
      const rows = runningRate(nights);
      return figure({
        reading: `${rows[rows.length - 1]!.rate}% after ${rows.length} matches.`,
        table: { head: ["After", "Win rate"], rows: rows.map((r) => [r.label, `${r.rate}%`]) },
        children: (
          <LineChart
            label={`${name}'s season singles win rate after each match`}
            categories={rows.map((r) => r.label)}
            series={[{ label: "Win rate", values: rows.map((r) => r.rate), color: COLOR.player, main: true }]}
            domain={[0, 100]}
            format={percent}
            area
            tip={(i) => [`After ${rows[i]!.label}`, `${rows[i]!.rate}% for the season`]}
          />
        ),
      });
    }

    case "recent-form": {
      const rows = rollingForm(singles);
      return figure({
        reading: `Now ${rows[rows.length - 1]!.rate}% over the last six. A drop shows a bad night straight away; the season figure hides it.`,
        table: { head: ["Singles", "Result", "Last six"], rows: rows.map((r) => [`${r.index}. ${r.opponent}`, r.won ? "Won" : "Lost", `${r.rate}%`]) },
        children: (
          <LineChart
            label={`${name}'s win rate over the most recent six singles`}
            categories={rows.map((r) => String(r.index))}
            series={[{ label: "Last six singles", values: rows.map((r) => r.rate), color: COLOR.player, main: true }]}
            domain={[0, 100]}
            format={percent}
            area
            tip={(i) => [`Singles ${rows[i]!.index}: ${rows[i]!.won ? "beat" : "lost to"} ${rows[i]!.opponent}`, `Last six: ${rows[i]!.rate}%`]}
          />
        ),
      });
    }

    case "games": {
      return figure({
        wide: singles.length > 9,
        reading: "Games won stand above the line and games lost hang below it. A 3–2 win shows two below.",
        table: {
          head: ["Opponent", "Date", "Games", "Scores"],
          rows: singles.map((s) => [opponentName(s), formatDateShort(s.playedOn), `${s.setsFor}–${s.setsAgainst}`, s.games.map((g) => g.join("-")).join(", ")]),
        },
        children: (
          <ColumnChart
            label={`Games won and lost in each of ${name}'s singles`}
            categories={singles.map((s) => surname(opponentName(s)))}
            up={{ label: "Games won", values: singles.map((s) => s.setsFor), color: COLOR.won }}
            down={{ label: "Games lost", values: singles.map((s) => s.setsAgainst), color: COLOR.lost }}
            yMax={3}
            tip={(i) => [`${singles[i]!.won ? "Beat" : "Lost to"} ${opponentName(singles[i]!)}`, `${singles[i]!.setsFor}–${singles[i]!.setsAgainst}: ${singles[i]!.games.map((g) => g.join("-")).join(", ")}`]}
          />
        ),
      });
    }

    case "margins": {
      const games = gamesOf(singles);
      const counts = marginCounts(games);
      const wonGames = games.filter((g) => g.won);
      const average = wonGames.length ? (wonGames.reduce((sum, g) => sum + g.for - g.against, 0) / wonGames.length).toFixed(1) : "—";
      return figure({
        reading: `${games.length} games. The games ${name} won were won by ${average} points on average; the bars at ±2 are the close ones, including deuce.`,
        table: { head: ["Margin", "Games"], rows: counts.filter((c) => c.count > 0).map((c) => [c.margin > 0 ? `Won by ${c.margin}` : `Lost by ${-c.margin}`, c.count]) },
        children: (
          <>
            <Legend items={[{ label: "Games won", color: COLOR.won }, { label: "Games lost", color: COLOR.lost }]} />
            <ColumnChart
              label={`${name}'s singles games by points margin`}
              categories={counts.map((c) => (c.margin > 0 ? `+${c.margin}` : String(c.margin)))}
              up={{ label: "Games", values: counts.map((c) => c.count), color: (i) => (counts[i]!.margin > 0 ? COLOR.won : COLOR.lost) }}
              legend={false}
              yLabel="games"
              tip={(i) => [counts[i]!.margin > 0 ? `Won by ${counts[i]!.margin}` : `Lost by ${-counts[i]!.margin}`, `${counts[i]!.count} game${counts[i]!.count === 1 ? "" : "s"}`]}
            />
          </>
        ),
      });
    }

    case "pressure": {
      const rows = pressure(singles).filter((r) => r.won + r.lost > 0);
      return figure({
        reading: rows.length ? "Deuce games went beyond 11–10; a deciding game is the fifth." : `No tight moments on ${name}'s cards yet.`,
        table: { head: ["Moment", "Won", "Lost"], rows: rows.map((r) => [r.label, r.won, r.lost]) },
        children: rows.length ? <WonLostBars rows={rows} /> : <Empty>None yet.</Empty>,
      });
    }

    case "opponents": {
      const rows = byOpponentStrength(singles, data.opponentRates);
      return figure({
        reading: "Each opponent is grouped by their own singles win rate that season.",
        table: { head: ["Opponents", "Won", "Lost"], rows: rows.map((r) => [r.label, r.won, r.lost]) },
        children: <WonLostBars rows={rows} />,
      });
    }

    case "home-away": {
      const rows = homeAndAway(singles);
      return figure({
        reading: "Singles only; the doubles is a pair's result.",
        table: { head: ["Where", "Won", "Lost"], rows: rows.map((r) => [r.label, r.won, r.lost]) },
        children: <WonLostBars rows={rows} />,
      });
    }

    case "doubles": {
      const rows = doublesByPartner(rubbers);
      return figure({
        reading: "The doubles is not in the averages, but it is a point for the team.",
        table: { head: ["Partner", "Won", "Lost"], rows: rows.map((r) => [r.label, r.won, r.lost]) },
        children: <WonLostBars rows={rows} />,
      });
    }

    case "points-share": {
      const rows = pointsShare(nights);
      const low = Math.min(40, ...rows.map((r) => Math.floor((r.share - 5) / 10) * 10));
      const high = Math.max(70, ...rows.map((r) => Math.ceil((r.share + 5) / 10) * 10));
      return figure({
        reading: "Every point of the night's singles. Above the dashed 50% line, more points were won than lost.",
        table: { head: ["Match", "Points won", "Points lost", "Share"], rows: rows.map((r) => [r.label, r.for, r.against, `${r.share}%`]) },
        children: (
          <LineChart
            label={`Share of points ${name} won in each match`}
            categories={rows.map((r) => r.label)}
            series={[
              { label: "Points won", values: rows.map((r) => r.share), color: COLOR.player, main: true },
              { label: "Even", values: rows.map(() => 50), color: COLOR.others, dashed: true },
            ]}
            domain={[low, high]}
            format={percent}
            tip={(i) => [rows[i]!.label, `${rows[i]!.for} points won, ${rows[i]!.against} lost`, `${rows[i]!.share}%`]}
          />
        ),
      });
    }

    case "head-to-head": {
      const rows = headToHead(singles, data.opponentRates);
      return figure({
        wide: true,
        reading: "Their win rate is the opponent's own singles average that season.",
        children: (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  {["Opponent", "Team", "Their win rate", "Results", "Games"].map((head, index) => (
                    <th key={head} scope="col" className={cn("border-b border-line bg-surface-sunken px-3 py-2 font-semibold", index >= 2 && index !== 3 && "text-right")}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.slug ?? row.opponent}>
                    <td className="border-b border-line px-3 py-2 font-semibold">
                      {row.slug ? (
                        <Link href={`/players/${row.slug}`} className="link">
                          {row.opponent}
                        </Link>
                      ) : (
                        row.opponent
                      )}
                    </td>
                    <td className="border-b border-line px-3 py-2 text-ink-muted">{row.team}</td>
                    <td className="border-b border-line px-3 py-2 text-right tabular">{row.rate === null ? "—" : `${row.rate}%`}</td>
                    <td className="border-b border-line px-3 py-2">
                      <span className="flex flex-wrap gap-1.5">
                        {row.results.map((result, index) => (
                          <span
                            key={index}
                            title={result.games.map((g) => g.join("-")).join(", ")}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-line px-2 tabular"
                          >
                            <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: result.won ? COLOR.won : COLOR.lost }} />
                            {result.won ? "Won" : "Lost"} {result.setsFor}–{result.setsAgainst}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="border-b border-line px-3 py-2 text-right tabular">
                      {row.gamesFor}–{row.gamesAgainst}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      });
    }

    default:
      return null;
  }
}
