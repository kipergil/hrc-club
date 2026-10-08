// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Router } from "wouter";
import { STAT_CHARTS } from "@/lib/stat-charts";
import { matchNights, singlesOf } from "@/lib/player-stats";
import { STATISTICS } from "@/lib/player-stats.fixture";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { keys } from "@/lib/queries";
import PlayerStatsPage, { StatChart } from "./player-stats";

const context = {
  data: STATISTICS,
  name: "Derek Balding",
  nights: matchNights(STATISTICS.rubbers),
  singles: singlesOf(STATISTICS.rubbers),
  rubbers: STATISTICS.rubbers,
  cardSeason: "2026-27",
};

describe("every chart in the catalogue", () => {
  for (const chart of STAT_CHARTS) {
    it(`draws "${chart.title}"`, () => {
      const { container } = render(
        <Router>
          <StatChart id={chart.id} context={context} />
        </Router>,
      );
      // A catalogue entry with no drawing renders nothing at all.
      const figure = container.querySelector("figure");
      expect(figure, `no figure for ${chart.id}`).not.toBeNull();
      expect(within(figure!).getByRole("heading", { name: chart.title })).toBeTruthy();
      // A chart is a picture with a name, or a list or table a reader can read.
      const drawn = figure!.querySelector("svg[role=img][aria-label], ul, table");
      expect(drawn, `nothing drawn for ${chart.id}`).not.toBeNull();
    });
  }

  it("offers the numbers behind a chart as a table", () => {
    render(
      <Router>
        <StatChart id="form" context={context} />
      </Router>,
    );
    const toggle = screen.getByRole("button", { name: "Show the numbers" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(4); // a header and three nights
  });
});

describe("the info button on every chart", () => {
  const draw = (id: string) =>
    render(
      <Router>
        <StatChart id={id} context={context} />
      </Router>,
    );

  it("is there for every chart, closed until asked", () => {
    for (const chart of STAT_CHARTS) {
      const { unmount } = draw(chart.id);
      const button = screen.getByRole("button", { name: `About this chart: ${chart.title}` });
      expect(button.getAttribute("aria-expanded")).toBe("false");
      expect(screen.getByText(chart.about).closest("[hidden]")).not.toBeNull();
      unmount();
    }
  });

  it("opens on a tap, and closes on Escape and on a tap elsewhere", () => {
    const chart = STAT_CHARTS.find((one) => one.id === "season-placing")!;
    draw(chart.id);
    const button = screen.getByRole("button", { name: `About this chart: ${chart.title}` });

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(chart.about).closest("[hidden]")).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText(chart.about).closest("[hidden]")).not.toBeNull();

    fireEvent.click(button);
    fireEvent.pointerDown(document.body);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("the division, season by season", () => {
  it("names each season's division under it on the axis", () => {
    const { container } = render(
      <Router>
        <StatChart id="season-rate" context={context} />
      </Router>,
    );
    const axis = [...container.querySelectorAll("svg text")].map((node) => node.textContent);
    expect(axis).toContain("Div 1");
    expect(axis).toContain("Premier");
  });

  it("carries it into the numbers table", () => {
    render(
      <Router>
        <StatChart id="season-placing" context={context} />
      </Router>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show the numbers" }));
    const rows = within(screen.getByRole("table")).getAllByRole("row").map((row) => row.textContent);
    expect(rows[0]).toContain("Division");
    expect(rows[1]).toContain("Division 1");
    expect(rows[2]).toContain("Premier Division");
  });
});

describe("the seasons filter", () => {
  /** The "singles played" figure in the totals row above the charts. */
  const played = () => {
    const row = document.querySelector('dl[aria-label^="Totals"]') as HTMLElement;
    return within(row).getByText("singles played").previousElementSibling?.textContent;
  };
  function renderPage() {
    window.history.replaceState({}, "", "/players/derek-balding/stats");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(keys.playerStatistics("derek-balding"), STATISTICS);
    return render(
      <QueryClientProvider client={client}>
        <Router>
          <PlayerStatsPage slug="derek-balding" />
        </Router>
      </QueryClientProvider>,
    );
  }

  it("opens on the latest season, with the season charts waiting for an earlier one", () => {
    renderPage();
    const latest = screen.getByRole("button", { name: "2026-27 only" });
    expect(latest.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("heading", { name: "Win rate each season" })).toBeNull();
    expect(screen.getByText(/reach back to an earlier season above: that adds win rate each season/)).toBeTruthy();
    // Totals for 2026-27 alone: 7 of 9.
    expect(played()).toBe("9");
  });

  it("adds the earlier season to the charts and to the totals", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "All 2, since 2025-26" }));
    expect(window.location.search).toBe("?since=2025-26");
    expect(screen.getByRole("heading", { name: "Win rate each season" })).toBeTruthy();
    expect(played()).toBe("33");
    expect(screen.getByText("Division 1 in 2025-26, then Premier Division in 2026-27.")).toBeTruthy();
  });

  it("keeps the division section on the latest season, and says so", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "All 2, since 2025-26" }));
    expect(screen.getByText(/2026-27, the latest season\. A division is a snapshot/)).toBeTruthy();
  });
});
